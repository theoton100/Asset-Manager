import { useGetAnalysis, useDeleteAnalysis, getListAnalysesQueryKey, getGetAnalysesStatsQueryKey } from "@workspace/api-client-react";
import { AnalysisChat } from "@/components/analysis-chat";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, Minus, Info, FileText, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart
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
import { useState } from "react";

export function AnalysisDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: analysis, isLoading, isError, error } = useGetAnalysis(id);
  
  const deleteMutation = useDeleteAnalysis({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesStatsQueryKey() });
        setLocation("/");
      }
    }
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
          <h2 className="text-xl font-semibold mb-2">Failed to load analysis</h2>
          <p className="text-muted-foreground mb-6">{error?.error || "Unknown error occurred"}</p>
          <Button variant="outline" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4 -ml-3 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Workspace
          </Button>
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-bold tracking-tight">{analysis.title}</h1>
            <Badge 
              variant="outline" 
              className={
                analysis.sentiment === "positive" ? "text-emerald-600 border-emerald-200 bg-emerald-50/50" :
                analysis.sentiment === "negative" ? "text-rose-600 border-rose-200 bg-rose-50/50" :
                "text-slate-600 border-slate-200 bg-slate-50/50"
              }
            >
              {analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1)}
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-4xl">
            {analysis.summary}
          </p>
          
          <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>{analysis.filename}</span>
            </div>
            <span>&bull;</span>
            <span>{format(new Date(analysis.createdAt), "MMMM d, yyyy h:mm a")}</span>
            <span>&bull;</span>
            <span>{(analysis.fileSize / 1024).toFixed(1)} KB</span>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the analysis of "{analysis.filename}". This action cannot be undone.
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

      {analysis.keyMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {analysis.keyMetrics.map((metric, i) => (
            <Card key={i} className="bg-card/50">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2">{metric.label}</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-bold tracking-tight">
                    {metric.unit === "$" ? "$" : ""}{metric.value.toLocaleString()}
                    {metric.unit && metric.unit !== "$" ? ` ${metric.unit}` : ""}
                  </span>
                </div>
                {metric.change != null && (
                  <div className={`flex items-center text-sm font-medium ${
                    metric.change > 0 ? "text-emerald-600" : 
                    metric.change < 0 ? "text-rose-600" : 
                    "text-slate-500"
                  }`}>
                    {metric.change > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : 
                     metric.change < 0 ? <TrendingDown className="w-4 h-4 mr-1" /> : 
                     <Minus className="w-4 h-4 mr-1" />}
                    {Math.abs(metric.change * 100).toFixed(1)}% vs previous
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {analysis.insights.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" /> Key Insights
          </h3>
          <div className="grid gap-4">
            {analysis.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-semibold text-sm mt-0.5">
                  {i + 1}
                </div>
                <p className="text-foreground leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.forecasts.length > 0 && (
        <div className="mb-12 space-y-8">
          <h3 className="text-xl font-semibold mb-2">Forecasts & Projections</h3>
          {analysis.forecasts.map((forecast, i) => {
            const data = [
              ...forecast.history.map(pt => ({
                period: pt.period,
                actual: pt.value,
                forecast: null,
                lower: null,
                upper: null,
              })),
              ...forecast.projection.map(pt => ({
                period: pt.period,
                actual: null,
                forecast: pt.value,
                lower: pt.lower,
                upper: pt.upper,
                range: [pt.lower, pt.upper]
              }))
            ];

            return (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>{forecast.label}</CardTitle>
                  <CardDescription>Method: {forecast.method}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="period" 
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                          dx={-10}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "hsl(var(--popover))", borderRadius: "8px", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-sm)" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
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
                          stroke="hsl(var(--foreground))" 
                          strokeWidth={2} 
                          dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }}
                          activeDot={{ r: 6 }} 
                          isAnimationActive={true}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="forecast" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={true}
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

      {analysis.timeSeries.length > 0 && (
        <div className="mb-12 space-y-8">
          <h3 className="text-xl font-semibold mb-2">Historical Time Series</h3>
          {analysis.timeSeries.map((series, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle>{series.label}</CardTitle>
                {series.unit && <CardDescription>Values in {series.unit}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series.points} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <defs>
                        <linearGradient id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--popover))", borderRadius: "8px", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-sm)" }}
                        itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
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
          className="mb-12 border border-border rounded-xl bg-card overflow-hidden"
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-4 h-auto rounded-none hover:bg-muted/50">
              <span className="font-semibold text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Source Text Preview
              </span>
              {isPreviewOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
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
