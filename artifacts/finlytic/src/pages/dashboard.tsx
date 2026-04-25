import { useMemo, useState } from "react";
import {
  useGetAnalysesStats,
  useListAnalyses,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { FileUpload } from "@/components/file-upload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  TrendingUp,
  Brain,
  FileBox,
  Activity,
  Search,
} from "lucide-react";
import { sentimentBadgeClass, sentimentLabel } from "@/lib/sentiment";

function StatsCards() {
  const { data: stats, isLoading } = useGetAnalysesStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Analyses
          </CardTitle>
          <FileBox className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAnalyses}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Metrics Extracted
          </CardTitle>
          <Activity className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.totalMetricsExtracted}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Forecasts Generated
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalForecasts}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Sentiment Breakdown
          </CardTitle>
          <Brain className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span>{stats.sentimentBreakdown.positive}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
              <span>{stats.sentimentBreakdown.neutral}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <span>{stats.sentimentBreakdown.negative}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type SortKey = "newest" | "oldest" | "title" | "sentiment";
type SentimentFilter = "all" | "positive" | "neutral" | "negative";

function RecentAnalyses() {
  const { data: analyses, isLoading } = useListAnalyses();
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    if (!analyses) return [];
    let out = [...analyses];
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.filename.toLowerCase().includes(q),
      );
    }
    if (sentiment !== "all") {
      out = out.filter((a) => a.sentiment === sentiment);
    }
    switch (sort) {
      case "oldest":
        out.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "title":
        out.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "sentiment": {
        const order = { positive: 0, neutral: 1, negative: 2 } as Record<
          string,
          number
        >;
        out.sort(
          (a, b) =>
            (order[a.sentiment] ?? 99) - (order[b.sentiment] ?? 99),
        );
        break;
      }
      case "newest":
      default:
        out.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
    }
    return out;
  }, [analyses, search, sentiment, sort]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-48">
            <CardContent className="p-6 h-full flex flex-col justify-between">
              <div>
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="flex justify-between items-center mt-4">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analyses || analyses.length === 0) {
    return (
      <div className="text-center py-24 bg-card/30 border border-dashed rounded-xl">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          No analyses yet
        </h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Upload a financial document above to generate your first analysis,
          pull metrics, and create forecasts.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, summary, or filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <Select
          value={sentiment}
          onValueChange={(v) => setSentiment(v as SentimentFilter)}
        >
          <SelectTrigger className="w-full sm:w-[160px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sentiments</SelectItem>
            <SelectItem value="positive">Positive</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="negative">Negative</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[160px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="title">Title (A-Z)</SelectItem>
            <SelectItem value="sentiment">By sentiment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card/30 border border-dashed rounded-xl">
          <p className="text-muted-foreground">
            No analyses match your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((analysis) => (
            <Link key={analysis.id} href={`/analyses/${analysis.id}`}>
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {analysis.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {analysis.summary}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                    <Badge
                      variant="outline"
                      className={sentimentBadgeClass(analysis.sentiment)}
                    >
                      {sentimentLabel(analysis.sentiment)}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function Dashboard() {
  return (
    <Layout>
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
          Workspace
        </h1>
        <p className="text-muted-foreground">
          Upload and analyze your financial documents.
        </p>
      </div>

      <StatsCards />

      <div className="mb-16">
        <FileUpload />
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Recent Analyses
          </h2>
        </div>
        <RecentAnalyses />
      </div>
    </Layout>
  );
}
