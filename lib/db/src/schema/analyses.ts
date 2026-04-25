import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export type KeyMetric = {
  label: string;
  value: number;
  unit?: string | null;
  change?: number | null;
};

export type SeriesPoint = { period: string; value: number };

export type TimeSeries = {
  label: string;
  unit?: string | null;
  points: SeriesPoint[];
};

export type ForecastPoint = {
  period: string;
  value: number;
  lower: number;
  upper: number;
};

export type Forecast = {
  label: string;
  method: string;
  history: SeriesPoint[];
  projection: ForecastPoint[];
};

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  sentiment: text("sentiment").notNull(),
  keyMetrics: jsonb("key_metrics").$type<KeyMetric[]>().notNull().default([]),
  timeSeries: jsonb("time_series").$type<TimeSeries[]>().notNull().default([]),
  forecasts: jsonb("forecasts").$type<Forecast[]>().notNull().default([]),
  insights: jsonb("insights").$type<string[]>().notNull().default([]),
  rawTextPreview: text("raw_text_preview").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Analysis = typeof analysesTable.$inferSelect;
export type InsertAnalysis = typeof analysesTable.$inferInsert;
