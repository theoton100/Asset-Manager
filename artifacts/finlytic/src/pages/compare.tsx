import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import {
  useGetAnalysis,
  useListAnalyses,
} from "@workspace/api-client-react";
import type { Analysis } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  ArrowLeft,
  GitCompare,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatValue, formatValueCompact } from "@/lib/format";
import { sentimentBadgeClass } from "@/lib/sentiment";

function useQueryParams(): URLSearchParams {
  const [location] = useLocation();
  return useMemo(() => {
    const idx = location.indexOf("?");
    return new URLSearchParams(idx >= 0 ? location.slice(idx + 1) : "");
  }, [location]);
}

export function Compare() {
  const params = useQueryParams();
  const [, setLocation] = useLocation();
  const initialA = params.get("a");
  const initialB = params.get("b");

  const [aId, setAId] = useState<string>(initialA ?? "");
  const [bId, setBId] = useState<string>(initialB ?? "");

  useEffect(() => {
    setAId(initialA ?? "");
    setBId(initialB ?? "");
  }, [initialA, initialB]);

  const { data: analyses, isLoading: listLoading } = useListAnalyses();

  function applySelection(nextA: string, nextB: string) {
    setAId(nextA);
    setBId(nextB);
    const sp = new URLSearchParams();
    if (nextA) sp.set("a", nextA);
    if (nextB) sp.set("b", nextB);
    const query = sp.toString();
    setLocation(query ? `/compare?${query}` : "/compare", { replace: true });
  }

  return (
    <Layout>
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-3 text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Workspace
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <GitCompare className="w-5 h-5" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Compare analyses</h1>
        </div>
        <p className="text-muted-foreground">
          Pick any two analyses to view their metrics, sentiment, and forecasts side by side.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <AnalysisPicker
          label="Left"
          value={aId}
          options={analyses ?? []}
          isLoading={listLoading}
          excludeId={bId}
          onChange={(v) => applySelection(v, bId)}
        />
        <AnalysisPicker
          label="Right"
          value={bId}
          options={analyses ?? []}
          isLoading={listLoading}
          excludeId={aId}
          onChange={(v) => applySelection(aId, v)}
        />
      </div>

      {(!aId || !bId) ? (
        <div className="text-center py-20 border border-dashed rounded-xl bg-card/30">
          <GitCompare className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="font-medium mb-1">Choose two analyses to compare</h3>
          <p className="text-sm text-muted-foreground">
            Use the dropdowns above. Pick a different one for each side.
          </p>
        </div>
      ) : (
        <ComparisonView aId={parseInt(aId, 10)} bId={parseInt(bId, 10)} />
      )}
    </Layout>
  );
}

function AnalysisPicker({
  label,
  value,
  options,
  isLoading,
  excludeId,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: number; title: string; createdAt: string }[];
  isLoading: boolean;
  excludeId: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder={isLoading ? "Loading..." : "Select an analysis"} />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter((o) => String(o.id) !== excludeId)
            .map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.title}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ComparisonView({ aId, bId }: { aId: number; bId: number }) {
  const a = useGetAnalysis(aId);
  const b = useGetAnalysis(bId);

  if (a.isLoading || b.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!a.data || !b.data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Could not load one of the analyses.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HeaderCard analysis={a.data} />
        <HeaderCard analysis={b.data} />
      </div>

      {/* Key metrics aligned */}
      <KeyMetricsCompare a={a.data} b={b.data} />

      {/* Time series side-by-side */}
      <TimeSeriesCompare a={a.data} b={b.data} />

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightsList analysis={a.data} />
        <InsightsList analysis={b.data} />
      </div>
    </div>
  );
}

function HeaderCard({ analysis }: { analysis: Analysis }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/analyses/${analysis.id}`}>
              <CardTitle className="text-lg leading-snug line-clamp-2 hover:text-primary transition-colors cursor-pointer">
                {analysis.title}
              </CardTitle>
            </Link>
            <p className="text-xs text-muted-foreground font-mono mt-2">
              {analysis.filename} &middot;{" "}
              {format(new Date(analysis.createdAt), "MMM d, yyyy")}
            </p>
          </div>
          <Badge
            variant="outline"
            className={sentimentBadgeClass(analysis.sentiment)}
          >
            {analysis.sentiment}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-4">
          {analysis.summary}
        </p>
      </CardContent>
    </Card>
  );
}

function KeyMetricsCompare({ a, b }: { a: Analysis; b: Analysis }) {
  const labels = Array.from(
    new Set([
      ...a.keyMetrics.map((m) => m.label),
      ...b.keyMetrics.map((m) => m.label),
    ]),
  );
  if (labels.length === 0) return null;

  const aMap = new Map(a.keyMetrics.map((m) => [m.label, m]));
  const bMap = new Map(b.keyMetrics.map((m) => [m.label, m]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Key metrics</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left font-medium px-4 py-2">Metric</th>
                <th className="text-right font-medium px-4 py-2">Left</th>
                <th className="text-right font-medium px-4 py-2">Right</th>
                <th className="text-right font-medium px-4 py-2 w-32">Δ</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => {
                const ma = aMap.get(label);
                const mb = bMap.get(label);
                const delta =
                  ma && mb && ma.value !== 0
                    ? (mb.value - ma.value) / Math.abs(ma.value)
                    : null;
                return (
                  <tr key={label} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{label}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {ma ? formatValue(ma.value, ma.unit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {mb ? formatValue(mb.value, mb.unit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeltaBadge delta={delta} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-muted-foreground">—</span>;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color =
    delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500";
  return (
    <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {(Math.abs(delta) * 100).toFixed(1)}%
    </span>
  );
}

function TimeSeriesCompare({ a, b }: { a: Analysis; b: Analysis }) {
  if (a.timeSeries.length === 0 && b.timeSeries.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SeriesCard analysis={a} label="Left" />
      <SeriesCard analysis={b} label="Right" />
    </div>
  );
}

function SeriesCard({ analysis, label }: { analysis: Analysis; label: string }) {
  const series = analysis.timeSeries[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="truncate">{series?.label ?? "No time series"}</span>
          <span className="text-xs text-muted-foreground font-normal">{label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {series ? (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="period"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatValueCompact(v, series.unit)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(v: number) => formatValue(v, series.unit)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            No time series available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightsList({ analysis }: { analysis: Analysis }) {
  if (analysis.insights.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Key insights</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {analysis.insights.map((ins, i) => (
            <li key={i} className="text-sm flex gap-2 leading-relaxed">
              <span className="text-primary font-semibold">{i + 1}.</span>
              <span className="text-foreground">{ins}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
