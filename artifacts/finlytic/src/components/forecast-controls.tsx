import { useState } from "react";
import {
  useRegenerateForecast,
  useReanalyzeAnalysis,
  getGetAnalysisQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";

const HORIZONS = [3, 6, 12, 24];

type Props = {
  analysisId: number;
  currentHorizon: number;
};

export function ForecastControls({ analysisId, currentHorizon }: Props) {
  const queryClient = useQueryClient();
  const [horizon, setHorizon] = useState<number>(currentHorizon);
  const queryKey = getGetAnalysisQueryKey(analysisId);

  const regenMutation = useRegenerateForecast({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(queryKey, data);
      },
    },
  });

  const reanalyzeMutation = useReanalyzeAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(queryKey, data);
      },
    },
  });

  const horizonChanged = horizon !== currentHorizon;
  const busy = regenMutation.isPending || reanalyzeMutation.isPending;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/30 print:hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground shrink-0">
          Horizon:
        </span>
        <div className="inline-flex rounded-lg border bg-background p-1 gap-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                horizon === h
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          periods ahead
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            regenMutation.mutate({ id: analysisId, data: { horizon } })
          }
          disabled={busy || !horizonChanged}
        >
          {regenMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          Apply horizon
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reanalyzeMutation.mutate({ id: analysisId })}
          disabled={busy}
          title="Re-run AI extraction on the source text"
        >
          {reanalyzeMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
          )}
          Re-analyze
        </Button>
      </div>
    </div>
  );
}
