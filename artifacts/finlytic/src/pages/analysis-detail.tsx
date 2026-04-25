import { useState } from "react";
import {
  useGetAnalysis,
  useDeleteAnalysis,
  useUpdateAnalysisTags,
  getListAnalysesQueryKey,
  getGetAnalysesStatsQueryKey,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { AnalysisChat } from "@/components/analysis-chat";
import { TagsInput } from "@/components/tags-input";
import { ForecastControls } from "@/components/forecast-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  ArrowLeft,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Share2,
  Printer,
  ShieldQuestion,
  Check,
} from "lucide-react";
import {
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatValue, formatValueCompact, formatPercent } from "@/lib/format";
import { sentimentBadgeClass, sentimentLabel } from "@/lib/sentiment";

export function AnalysisDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: analysis, isLoading, isError, error } = useGetAnalysis(id);

  const deleteMutation = useDeleteAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({
          queryKey: getGetAnalysesStatsQueryKey(),
        });
        setLocation("/");
      },
    },
  });

  const tagsMutation = useUpdateAnalysisTags({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetAnalysisQueryKey(id), data);
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
      },
    },
  });

  function handleShare() {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          window.prompt("Copy this link:", url);
        });
    } else {
      window.prompt("Copy this link:", url);
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-8 animate-pulse">
          <div>
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-6 w-full max-w-2xl mb-2" />
            <Skeleton className="h-6 w-full max-w-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </Layout>
    );
  }

  if (isError || !analysis) {
    return (
      <Layout>
        <div className="text-center py-20">
          <div className="text-destructive mb-4">
            <Info className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">
            Failed to load analysis
          </h2>
          <p className="text-muted-foreground mb-6">
            {(error as { error?: string } | null | undefined)?.error ||
              "Unknown error occurred"}
          </p>
          <Button variant="outline" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  const warnings = analysis.warnings ?? [];
  const tags = analysis.tags ?? [];
  const horizon = analysis.forecastHorizon ?? 6;

  return (
    <Layout>
      <div className="mb-8 flex items-start justify-between gap-4 print:block">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-3 text-muted-foreground hover:text-foreground print:hidden"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Workspace
          </Button>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">
              {analysis.title}
            </h1>
            <Badge
              variant="outline"
              className={sentimentBadgeClass(analysis.sentiment)}
            >
              {sentimentLabel(analysis.sentiment)}
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-4xl">
            {analysis.summary}
          </p>

          <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground font-mono flex-wrap">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>{analysis.filename}</span>
            </div>
            <span>&bull;</span>
            <span>
              {format(new Date(analysis.createdAt), "MMMM d, yyyy h:mm a")}
            </span>
            <span>&bull;</span>
            <span>{(analysis.fileSize / 1024).toFixed(1)} KB</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            title="Copy link to this analysis"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-1.5" />
                Share
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Export
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the analysis of "
                  {analysis.filename}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate({ id })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Warnings (e.g. image-based PDF) */}
      {warnings.length > 0 && (
        <div className="mb-8 space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                {w}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tags editor */}
      <div className="mb-10 print:hidden">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Tags
        </label>
        <TagsInput
          value={tags}
          onChange={(next) => tagsMutation.mutate({ id, data: { tags: next } })}
          isPending={tagsMutation.isPending}
          placeholder="Add tags like Q1, FY24, projects..."
        />
      </div>

      {/* Tags (print view) */}
      {tags.length > 0 && (
        <div className="mb-8 hidden print:flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Key metrics */}
      {analysis.keyMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {analysis.keyMetrics.map((metric, i) => (
            <Card key={i} className="bg-card/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  {metric.confidence != null && metric.confidence < 0.6 && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/30 px-1.5 py-0.5 rounded"
                      title={`Model confidence ${(metric.confidence * 100).toFixed(0)}%`}
                    >
                      <ShieldQuestion className="w-3 h-3" />
                      Low confidence
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold tracking-tight tabular-nums">
                    {formatValue(metric.value, metric.unit)}
                  </span>
                </div>
                {metric.change != null && (
                  <div
                    className={`flex items-center text-sm font-medium ${
                      metric.change > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : metric.change < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500"
                    }`}
                  >
                    {metric.change > 0 ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : metric.change < 0 ? (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    ) : (
                      <Minus className="w-4 h-4 mr-1" />
                    )}
                    {formatPercent(Math.abs(metric.change))} vs previous
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Key Insights
          </h3>
          <div className="grid gap-4">
            {analysis.insights.map((insight, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-semibold text-sm mt-0.5">
                  {i + 1}
                </div>
                <p className="text-foreground leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecasts */}
      {analysis.forecasts.length > 0 && (
        <div className="mb-12 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h3 className="text-xl font-semibold">Forecasts & Projections</h3>
          </div>

          <ForecastControls analysisId={id} currentHorizon={horizon} />

          {analysis.forecasts.map((forecast, i) => {
            const seriesUnit =
              analysis.timeSeries.find((s) => s.label === forecast.label)?.unit ??
              null;

            const data = [
              ...forecast.history.map((pt) => ({
                period: pt.period,
                actual: pt.value,
                forecast: null as number | null,
                range: undefined as [number, number] | undefined,
              })),
              ...forecast.projection.map((pt) => ({
                period: pt.period,
                actual: null as number | null,
                forecast: pt.value,
                range: [pt.lower, pt.upper] as [number, number],
              })),
            ];

            return (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>{forecast.label}</CardTitle>
                  <CardDescription>
                    Method: {forecast.method} &middot; horizon: {horizon} period
                    {horizon === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="period"
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 12,
                          }}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          tick={{
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 12,
                          }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) =>
                            formatValueCompact(value, seriesUnit)
                          }
                          width={70}
                          dx={-5}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "var(--shadow-sm)",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value, name) => {
                            const label = String(name);
                            if (value == null) return ["—", label];
                            if (Array.isArray(value)) {
                              const [lo, hi] = value as [number, number];
                              return [
                                `${formatValue(lo, seriesUnit)} – ${formatValue(hi, seriesUnit)}`,
                                "95% range",
                              ];
                            }
                            return [
                              formatValue(Number(value), seriesUnit),
                              label,
                            ];
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="range"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.1}
                          stroke="none"
                          isAnimationActive={true}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="Actual"
                          stroke="hsl(var(--foreground))"
                          strokeWidth={2}
                          dot={{
                            r: 4,
                            fill: "hsl(var(--background))",
                            strokeWidth: 2,
                          }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          name="Forecast"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{
                            r: 4,
                            fill: "hsl(var(--background))",
                            strokeWidth: 2,
                          }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
                          connectNulls={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Time series */}
      {analysis.timeSeries.length > 0 && (
        <div className="mb-12 space-y-8">
          <h3 className="text-xl font-semibold mb-2">Historical Time Series</h3>
          {analysis.timeSeries.map((series, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>{series.label}</CardTitle>
                {series.unit && (
                  <CardDescription>Values in {series.unit}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={series.points}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id={`color-${i}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="period"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 12,
                        }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 12,
                        }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          formatValueCompact(value, series.unit)
                        }
                        width={70}
                        dx={-5}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "var(--shadow-sm)",
                        }}
                        itemStyle={{
                          color: "hsl(var(--foreground))",
                          fontWeight: 500,
                        }}
                        formatter={(value: number) => [
                          formatValue(value, series.unit),
                          series.label,
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={`url(#color-${i})`}
                        isAnimationActive={true}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analysis.rawTextPreview && (
        <Collapsible
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          className="mb-12 border border-border rounded-xl bg-card overflow-hidden print:hidden"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-4 h-auto rounded-none hover:bg-muted/50"
            >
              <span className="font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Source Text Preview
              </span>
              {isPreviewOpen ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-6 bg-muted/30 border-t border-border">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground max-h-[400px] overflow-y-auto rounded bg-background p-4 border shadow-inner">
                {analysis.rawTextPreview}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <AnalysisChat analysisId={analysis.id} analysisTitle={analysis.title} />
    </Layout>
  );
}
