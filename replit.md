# Finlytic

A financial document analysis and forecasting workspace. Users upload a
PDF, CSV, XLSX, or TXT file (income statement, balance sheet, sales
report, budget, KPI dashboard, etc.). The backend parses the file, runs
an AI extraction pass to pull key metrics and time series, generates
simple linear-regression forecasts with confidence bands, and persists
the result for review.

## Architecture

- **Web frontend** — `artifacts/finlytic` (React + Vite + wouter +
  TanStack Query + shadcn/ui + Recharts). Pages:
  - `/` — Workspace dashboard with stats, multi-file drag-and-drop
    upload queue, and a searchable/filterable/sortable grid of
    recent analyses.
  - `/analyses/:id` — Detailed report with key metric cards (with
    confidence badges), time series area charts, forecast charts
    (history + projection + confidence band) with horizon controls
    and re-analyze, insights list, tags editor, warnings banner,
    source preview, share-link, export-as-PDF (print), delete, and
    AI chat assistant.
  - `/compare?a=<id>&b=<id>` — Side-by-side comparison of two
    analyses with aligned key-metrics table (and Δ%) and per-side
    time-series charts.
- Light/dark theme toggle in the header (persisted in localStorage,
  no flash via inline boot script in `index.html`). Print stylesheet
  forces light mode and avoids breaking cards across pages.
- **API server** — `artifacts/api-server` (Express 5 + drizzle-orm +
  pino). Routes mounted at `/api`:
  - `GET /healthz`
  - `GET /analyses` — list summaries
  - `GET /analyses/stats` — totals + sentiment breakdown + recent
  - `POST /analyses/upload` — multipart upload, runs full pipeline
  - `GET /analyses/:id` — full analysis
  - `DELETE /analyses/:id`
  - `PATCH /analyses/:id/tags` — replace tags (max 10, 32 chars,
    case-insensitive de-duped, trimmed)
  - `POST /analyses/:id/forecast` — re-run forecasts at a new
    horizon (3/6/12/24)
  - `POST /analyses/:id/reanalyze` — re-run AI extraction on the
    stored source text and rebuild forecasts
  - `POST /analyses/:id/chat` — AI chat grounded in this analysis
- **Database** — Replit PostgreSQL, single `analyses` table with
  `jsonb` columns for `key_metrics`, `time_series`, `forecasts`,
  `insights`, `tags` (string[]), `warnings` (string[]), plus
  `forecast_horizon` integer. Schema in
  `lib/db/src/schema/analyses.ts`.
- **OpenAPI** — `lib/api-spec/openapi.yaml`. Codegen produces:
  - `lib/api-zod` — server-side Zod request/response schemas.
    NOTE: `lib/api-zod/src/index.ts` must contain a single
    `export * from "./generated/api"` line. Codegen overwrites
    it with two `export *` lines that cause TS2308 duplicate-export
    errors on `UploadAnalysisBody`, `RegenerateForecastBody`, and
    `UpdateAnalysisTagsBody`; rewrite the file after every codegen.
  - `lib/api-client-react` — React Query hooks consumed by the web
    app (`useListAnalyses`, `useUploadAnalysis`/`uploadAnalysis`,
    `useGetAnalysis`, `useDeleteAnalysis`, `useGetAnalysesStats`,
    `useUpdateAnalysisTags`, `useRegenerateForecast`,
    `useReanalyzeAnalysis`, `useChatWithAnalysis`).
- **AI** — `lib/integrations-openrouter-ai` (OpenAI SDK pointed at the
  Replit OpenRouter proxy). Default model `openai/gpt-4o-mini`,
  configurable via `OPENROUTER_MODEL`. Returns strict JSON which is
  then defensively normalized in `artifacts/api-server/src/lib/aiExtract.ts`.

## Pipeline (POST /api/analyses/upload)

1. `parseUploadedFile` — uses `pdf-parse`, `papaparse`, `xlsx`, or raw
   utf-8 depending on extension/MIME. Caps the extracted text.
2. `extractAnalysis` — calls OpenRouter with a strict JSON schema
   prompt to pull title, summary, sentiment, key metrics, time series,
   and insights.
3. `buildForecasts` — runs simple linear regression on each time
   series, projects `horizon` periods forward (default 6, max 24),
   computes a 95% confidence band that widens with horizon.
4. Insert into `analyses`, return the full analysis.

## Important file locations

- Backend pipeline: `artifacts/api-server/src/lib/{parseFile,aiExtract,forecast}.ts`
- Backend routes: `artifacts/api-server/src/routes/analyses.ts`
- DB schema: `lib/db/src/schema/analyses.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Frontend pages: `artifacts/finlytic/src/pages/{dashboard,analysis-detail,compare}.tsx`
- Frontend reusable components:
  `artifacts/finlytic/src/components/{file-upload,tags-input,forecast-controls,theme-toggle,analysis-chat,layout}.tsx`
- Frontend formatters: `artifacts/finlytic/src/lib/{format,sentiment}.ts`
- Frontend theme + print stylesheet: `artifacts/finlytic/src/index.css`
- Theme boot script (avoids dark-mode flash): inline in `artifacts/finlytic/index.html`

## Conventions

- File uploads are limited to 10 MB; PDFs are read up to 10 pages.
  When a PDF yields <100 chars from a >50 KB file, we add a warning
  ("looks image-based / scanned — text extraction may be incomplete")
  to `analysis.warnings` rather than failing.
- All AI numbers are coerced/validated server-side; missing or
  unparseable values are dropped rather than guessed. The AI is
  asked to return per-metric `confidence` (0..1) and the UI shows
  a "Low confidence" badge below 0.6.
- Forecasts require at least 3 history points or they are skipped.
- Period labels are extended intelligently for year (`2024 → 2025`)
  and quarter (`Q1 2024 → Q2 2024`) patterns; otherwise `Period +N`.
- Currency formatting uses `Intl.NumberFormat` via
  `src/lib/format.ts` (`formatValue` for tooltips/cards,
  `formatValueCompact` for axis ticks). Recognized currency codes
  include USD, EUR, GBP, JPY, GHS, NGN, ZAR, INR, KES, BRL, etc.
- Multi-file uploads are processed sequentially via a queue
  managed in `components/file-upload.tsx` (`processingRef` guards
  against double-processing across re-renders).
