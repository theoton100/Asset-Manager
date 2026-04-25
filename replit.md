# Finlytic

A financial document analysis and forecasting workspace. Users upload a
PDF, CSV, XLSX, or TXT file (income statement, balance sheet, sales
report, budget, KPI dashboard, etc.). The backend parses the file, runs
an AI extraction pass to pull key metrics and time series, generates
simple linear-regression forecasts with confidence bands, and persists
the result for review.

## Architecture

- **Web frontend** — `artifacts/finlytic` (React + Vite + wouter +
  TanStack Query + shadcn/ui + Recharts). Two pages:
  - `/` — Workspace dashboard with stats, drag-and-drop upload, and a
    grid of recent analyses.
  - `/analyses/:id` — Detailed report with key metric cards, time
    series area charts, forecast charts (history + projection +
    confidence band), insights list, source preview, and delete.
- **API server** — `artifacts/api-server` (Express 5 + drizzle-orm +
  pino). Routes mounted at `/api`:
  - `GET /healthz`
  - `GET /analyses` — list summaries
  - `GET /analyses/stats` — totals + sentiment breakdown + recent
  - `POST /analyses/upload` — multipart upload, runs full pipeline
  - `GET /analyses/:id` — full analysis
  - `DELETE /analyses/:id`
- **Database** — Replit PostgreSQL, single `analyses` table with
  `jsonb` columns for `key_metrics`, `time_series`, `forecasts`,
  `insights`. Schema in `lib/db/src/schema/analyses.ts`.
- **OpenAPI** — `lib/api-spec/openapi.yaml`. Codegen produces:
  - `lib/api-zod` — server-side Zod request/response schemas.
  - `lib/api-client-react` — React Query hooks consumed by the web
    app (`useListAnalyses`, `useUploadAnalysis`, `useGetAnalysis`,
    `useDeleteAnalysis`, `useGetAnalysesStats`).
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
- Frontend pages: `artifacts/finlytic/src/pages/`
- Frontend theme: `artifacts/finlytic/src/index.css`

## Conventions

- File uploads are limited to 10 MB; PDFs are read up to 10 pages.
- All AI numbers are coerced/validated server-side; missing or
  unparseable values are dropped rather than guessed.
- Forecasts require at least 3 history points or they are skipped.
- Period labels are extended intelligently for year (`2024 → 2025`)
  and quarter (`Q1 2024 → Q2 2024`) patterns; otherwise `Period +N`.
