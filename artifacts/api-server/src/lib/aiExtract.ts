import { openrouter } from "@workspace/integrations-openrouter-ai";
import type {
  Forecast,
  KeyMetric,
  TimeSeries,
} from "@workspace/db";
import type { Logger } from "pino";
import { buildForecast } from "./forecast";

export type AiExtraction = {
  title: string;
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  keyMetrics: KeyMetric[];
  timeSeries: TimeSeries[];
  insights: string[];
};

const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are Finlytic, a meticulous financial analyst.

You receive the raw text or tabular contents of a financial document
(income statement, balance sheet, cash flow, sales report, budget, KPI
dashboard, etc.) and must return a structured analysis as STRICT JSON.

Return ONLY a JSON object — no prose, no markdown, no code fences.
The JSON must conform to this schema:

{
  "title": string,            // short descriptive title (max 80 chars)
  "summary": string,          // 2-4 sentence executive summary
  "sentiment": "positive" | "neutral" | "negative",
  "key_metrics": [            // 4-10 most important figures
    {
      "label": string,
      "value": number,
      "unit": string | null,  // "USD", "%", "units", null if unitless
      "change": number | null // period-over-period as a fraction (0.12 = +12%)
    }
  ],
  "time_series": [            // every multi-period series you can find
    {
      "label": string,
      "unit": string | null,
      "points": [{"period": string, "value": number}]
    }
  ],
  "insights": [string]        // 3-6 short, sharp observations
}

Rules:
- Numbers must be JSON numbers, not strings. Strip currency symbols and
  commas. Convert "1.2M" -> 1200000, "3.4B" -> 3400000000, "5%" -> 5.
- If a value is missing or unparseable, omit that metric or point.
- "period" labels must be consistent within a series (e.g. all "Q1 2023",
  or all "2021"). Order points chronologically.
- If the document is not financial in nature, still extract any numeric
  series and metrics you can, and set sentiment to "neutral".
- Never hallucinate figures that are not supported by the document.`;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function safeParseJson(raw: string): unknown {
  // Strip markdown fences if the model added them
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  // Try to extract the first JSON object substring
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object");
  }
  const candidate = cleaned.slice(start, end + 1);
  return JSON.parse(candidate);
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[,$\s]/g, "").replace(/%$/, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeExtraction(raw: unknown): AiExtraction {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const title =
    typeof obj.title === "string" && obj.title.trim().length > 0
      ? obj.title.trim().slice(0, 200)
      : "Untitled analysis";

  const summary =
    typeof obj.summary === "string" ? obj.summary.trim() : "";

  const sentimentRaw = String(obj.sentiment ?? "neutral").toLowerCase();
  const sentiment: AiExtraction["sentiment"] =
    sentimentRaw === "positive" || sentimentRaw === "negative"
      ? sentimentRaw
      : "neutral";

  const metricsRaw = Array.isArray(obj.key_metrics)
    ? obj.key_metrics
    : Array.isArray(obj.keyMetrics)
      ? obj.keyMetrics
      : [];
  const keyMetrics: KeyMetric[] = [];
  for (const m of metricsRaw) {
    if (!m || typeof m !== "object") continue;
    const mm = m as Record<string, unknown>;
    const label = typeof mm.label === "string" ? mm.label.trim() : "";
    const value = coerceNumber(mm.value);
    if (!label || value === null) continue;
    const unit =
      typeof mm.unit === "string" && mm.unit.trim().length > 0
        ? mm.unit.trim()
        : null;
    const change = coerceNumber(mm.change);
    keyMetrics.push({ label, value, unit, change });
  }

  const seriesRaw = Array.isArray(obj.time_series)
    ? obj.time_series
    : Array.isArray(obj.timeSeries)
      ? obj.timeSeries
      : [];
  const timeSeries: TimeSeries[] = [];
  for (const s of seriesRaw) {
    if (!s || typeof s !== "object") continue;
    const ss = s as Record<string, unknown>;
    const label = typeof ss.label === "string" ? ss.label.trim() : "";
    if (!label) continue;
    const unit =
      typeof ss.unit === "string" && ss.unit.trim().length > 0
        ? ss.unit.trim()
        : null;
    const pointsRaw = Array.isArray(ss.points) ? ss.points : [];
    const points = [];
    for (const p of pointsRaw) {
      if (!p || typeof p !== "object") continue;
      const pp = p as Record<string, unknown>;
      const period =
        typeof pp.period === "string"
          ? pp.period.trim()
          : pp.period != null
            ? String(pp.period).trim()
            : "";
      const value = coerceNumber(pp.value);
      if (!period || value === null) continue;
      points.push({ period, value });
    }
    if (points.length >= 2) {
      timeSeries.push({ label, unit, points });
    }
  }

  const insightsRaw = Array.isArray(obj.insights) ? obj.insights : [];
  const insights: string[] = [];
  for (const i of insightsRaw) {
    if (typeof i === "string" && i.trim().length > 0) {
      insights.push(i.trim());
    }
  }

  return { title, summary, sentiment, keyMetrics, timeSeries, insights };
}

export async function extractAnalysis(
  filename: string,
  fileType: string,
  rawText: string,
  log: Logger,
): Promise<AiExtraction> {
  const userPrompt = `Filename: ${filename}\nFile type: ${fileType}\n\nDocument contents:\n"""\n${truncate(
    rawText,
    50_000,
  )}\n"""\n\nReturn the structured JSON now.`;

  log.info({ model: MODEL, length: rawText.length }, "Calling OpenRouter for extraction");

  const response = await openrouter.chat.completions.create({
    model: MODEL,
    max_tokens: 8192,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenRouter returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = safeParseJson(content);
  } catch (err) {
    log.warn({ err, sample: content.slice(0, 400) }, "Failed to parse model JSON");
    throw new Error("Model returned malformed JSON");
  }

  return normalizeExtraction(parsed);
}

export function buildForecasts(
  series: TimeSeries[],
  horizon: number,
): Forecast[] {
  const out: Forecast[] = [];
  for (const s of series) {
    const f = buildForecast(s, horizon);
    if (f) out.push(f);
  }
  return out;
}
