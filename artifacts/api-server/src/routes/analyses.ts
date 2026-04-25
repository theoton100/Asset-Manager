import { Router, type IRouter } from "express";
import multer from "multer";
import { desc, eq } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";
import {
  GetAnalysisParams,
  DeleteAnalysisParams,
  GetAnalysisResponse,
  ListAnalysesResponse,
  GetAnalysesStatsResponse,
  ChatWithAnalysisParams,
  ChatWithAnalysisBody,
  ChatWithAnalysisResponse,
} from "@workspace/api-zod";
import { parseUploadedFile } from "../lib/parseFile";
import { extractAnalysis, buildForecasts } from "../lib/aiExtract";
import { chatAboutAnalysis } from "../lib/chat";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const MAX_PREVIEW = 4000;

function toListItem(a: typeof analysesTable.$inferSelect) {
  return {
    id: a.id,
    filename: a.filename,
    fileType: a.fileType,
    fileSize: a.fileSize,
    title: a.title,
    summary: a.summary,
    sentiment: a.sentiment,
    createdAt: a.createdAt,
  };
}

function toFullItem(a: typeof analysesTable.$inferSelect) {
  return {
    id: a.id,
    filename: a.filename,
    fileType: a.fileType,
    fileSize: a.fileSize,
    title: a.title,
    summary: a.summary,
    sentiment: a.sentiment,
    keyMetrics: a.keyMetrics,
    timeSeries: a.timeSeries,
    forecasts: a.forecasts,
    insights: a.insights,
    rawTextPreview: a.rawTextPreview,
    createdAt: a.createdAt,
  };
}

router.get("/analyses", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(analysesTable)
    .orderBy(desc(analysesTable.createdAt));
  res.json(ListAnalysesResponse.parse(rows.map(toListItem)));
});

router.get("/analyses/stats", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(analysesTable)
    .orderBy(desc(analysesTable.createdAt));

  let totalMetrics = 0;
  let totalForecasts = 0;
  const breakdown = { positive: 0, neutral: 0, negative: 0 };
  for (const r of rows) {
    totalMetrics += Array.isArray(r.keyMetrics) ? r.keyMetrics.length : 0;
    totalForecasts += Array.isArray(r.forecasts) ? r.forecasts.length : 0;
    if (r.sentiment === "positive") breakdown.positive += 1;
    else if (r.sentiment === "negative") breakdown.negative += 1;
    else breakdown.neutral += 1;
  }

  const recent = rows.slice(0, 5).map(toListItem);

  res.json(
    GetAnalysesStatsResponse.parse({
      totalAnalyses: rows.length,
      totalMetricsExtracted: totalMetrics,
      totalForecasts,
      sentimentBreakdown: breakdown,
      recent,
    }),
  );
});

router.post(
  "/analyses/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "Missing 'file' upload field" });
      return;
    }

    const horizonRaw = req.body?.horizon;
    const horizon = (() => {
      const n = Number(horizonRaw);
      if (!Number.isFinite(n) || n <= 0) return 6;
      return Math.min(24, Math.floor(n));
    })();

    const { originalname, mimetype, size, buffer } = req.file;

    let parsed;
    try {
      parsed = await parseUploadedFile(originalname, mimetype, buffer);
    } catch (err) {
      req.log.warn({ err }, "Failed to parse uploaded file");
      res.status(400).json({
        error:
          err instanceof Error ? err.message : "Could not read uploaded file",
      });
      return;
    }

    if (!parsed.rawText || parsed.rawText.trim().length === 0) {
      res
        .status(400)
        .json({ error: "Could not extract any text from the uploaded file" });
      return;
    }

    let extraction;
    try {
      extraction = await extractAnalysis(
        originalname,
        parsed.fileType,
        parsed.rawText,
        req.log,
      );
    } catch (err) {
      req.log.error({ err }, "AI extraction failed");
      res.status(502).json({
        error:
          err instanceof Error
            ? `AI analysis failed: ${err.message}`
            : "AI analysis failed",
      });
      return;
    }

    const forecasts = buildForecasts(extraction.timeSeries, horizon);

    const [inserted] = await db
      .insert(analysesTable)
      .values({
        filename: originalname,
        fileType: parsed.fileType,
        fileSize: size,
        title: extraction.title,
        summary: extraction.summary,
        sentiment: extraction.sentiment,
        keyMetrics: extraction.keyMetrics,
        timeSeries: extraction.timeSeries,
        forecasts,
        insights: extraction.insights,
        rawTextPreview: parsed.rawText.slice(0, MAX_PREVIEW),
      })
      .returning();

    if (!inserted) {
      res.status(500).json({ error: "Failed to persist analysis" });
      return;
    }

    res.status(201).json(GetAnalysisResponse.parse(toFullItem(inserted)));
  },
);

router.get("/analyses/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.json(GetAnalysisResponse.parse(toFullItem(row)));
});

router.post("/analyses/:id/chat", async (req, res): Promise<void> => {
  const params = ChatWithAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ChatWithAnalysisBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  try {
    const reply = await chatAboutAnalysis(row, body.data.messages, req.log);
    res.json(ChatWithAnalysisResponse.parse({ reply }));
  } catch (err) {
    req.log.error({ err }, "Chat failed");
    res.status(502).json({
      error:
        err instanceof Error ? `Chat failed: ${err.message}` : "Chat failed",
    });
  }
});

router.delete("/analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(analysesTable)
    .where(eq(analysesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
