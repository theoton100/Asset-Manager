import { openrouter } from "@workspace/integrations-openrouter-ai";
import type { Analysis } from "@workspace/db";
import type { Logger } from "pino";

const MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 4000;

function buildContext(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`Title: ${a.title}`);
  lines.push(`File: ${a.filename} (${a.fileType}, ${a.fileSize} bytes)`);
  lines.push(`Sentiment: ${a.sentiment}`);
  lines.push(`Summary: ${a.summary}`);

  if (a.keyMetrics.length > 0) {
    lines.push("");
    lines.push("Key metrics:");
    for (const m of a.keyMetrics) {
      const change =
        typeof m.change === "number"
          ? ` (${m.change >= 0 ? "+" : ""}${(m.change * 100).toFixed(1)}%)`
          : "";
      const unit = m.unit ? ` ${m.unit}` : "";
      lines.push(`- ${m.label}: ${m.value}${unit}${change}`);
    }
  }

  if (a.timeSeries.length > 0) {
    lines.push("");
    lines.push("Time series:");
    for (const s of a.timeSeries) {
      const unit = s.unit ? ` ${s.unit}` : "";
      const points = s.points
        .map((p) => `${p.period}=${p.value}`)
        .join(", ");
      lines.push(`- ${s.label}${unit}: ${points}`);
    }
  }

  if (a.forecasts.length > 0) {
    lines.push("");
    lines.push("Forecasts (linear regression with 95% confidence band):");
    for (const f of a.forecasts) {
      const points = f.projection
        .map(
          (p) =>
            `${p.period}=${p.value} [${p.lower.toFixed(2)}–${p.upper.toFixed(2)}]`,
        )
        .join(", ");
      lines.push(`- ${f.label}: ${points}`);
    }
  }

  if (a.insights.length > 0) {
    lines.push("");
    lines.push("Insights:");
    for (const i of a.insights) lines.push(`- ${i}`);
  }

  if (a.rawTextPreview && a.rawTextPreview.trim().length > 0) {
    lines.push("");
    lines.push("Source text excerpt:");
    lines.push(a.rawTextPreview.slice(0, 2000));
  }

  return lines.join("\n");
}

export async function chatAboutAnalysis(
  analysis: Analysis,
  history: ChatMessage[],
  log: Logger,
): Promise<string> {
  const trimmed = history
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));

  if (trimmed.length === 0 || trimmed[trimmed.length - 1]!.role !== "user") {
    throw new Error("Conversation must end with a user message");
  }

  const system = `You are Finlytic's assistant. The user is reviewing the
financial analysis below and may ask questions about it. Answer concisely,
ground every claim in the analysis data, and never invent figures that
aren't present. When the data is insufficient to answer, say so. Use the
exact currency code from the metrics (e.g. GHS, USD) — do not convert
between currencies. Keep responses under ~150 words unless asked for more.

=== Analysis context ===
${buildContext(analysis)}
=== end context ===`;

  log.info(
    { analysisId: analysis.id, messageCount: trimmed.length },
    "Chat request",
  );

  const response = await openrouter.chat.completions.create({
    model: MODEL,
    max_tokens: 600,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  const reply = response.choices[0]?.message?.content;
  if (typeof reply !== "string" || reply.trim().length === 0) {
    throw new Error("Empty reply from model");
  }
  return reply.trim();
}
