import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  File as FileIcon,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  uploadAnalysis,
  getListAnalysesQueryKey,
  getGetAnalysesStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

type QueueStatus = "queued" | "uploading" | "done" | "error";
type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  analysisId?: number;
  analysisTitle?: string;
  error?: string;
};

function isAllowed(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  return /\.(pdf|docx?|csv|xlsx|txt)$/i.test(file.name);
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const processingRef = useRef(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(isAllowed);
    if (arr.length === 0) return;
    const newItems: QueueItem[] = arr.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      status: "queued",
    }));
    setQueue((q) => [...q, ...newItems]);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (e.target.files?.length) addFiles(e.target.files);
      // Reset input so the same file can be selected again later
      e.target.value = "";
    },
    [addFiles],
  );

  const removeItem = useCallback((id: string) => {
    setQueue((q) => q.filter((item) => item.id !== id || item.status === "uploading"));
  }, []);

  const clearFinished = useCallback(() => {
    setQueue((q) => q.filter((item) => item.status !== "done"));
  }, []);

  // Process queue: upload one at a time
  useEffect(() => {
    if (processingRef.current) return;
    const next = queue.find((item) => item.status === "queued");
    if (!next) return;

    processingRef.current = true;
    setQueue((q) =>
      q.map((item) =>
        item.id === next.id ? { ...item, status: "uploading" } : item,
      ),
    );

    (async () => {
      try {
        const result = await uploadAnalysis({
          file: next.file,
          horizon: 6,
        });
        setQueue((q) =>
          q.map((item) =>
            item.id === next.id
              ? {
                  ...item,
                  status: "done",
                  analysisId: result.id,
                  analysisTitle: result.title,
                }
              : item,
          ),
        );
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({
          queryKey: getGetAnalysesStatsQueryKey(),
        });
      } catch (err) {
        const message =
          err && typeof err === "object" && "error" in err
            ? String((err as { error: unknown }).error)
            : err instanceof Error
              ? err.message
              : "Upload failed";
        setQueue((q) =>
          q.map((item) =>
            item.id === next.id
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );
      } finally {
        processingRef.current = false;
        // Trigger re-evaluation
        setQueue((q) => [...q]);
      }
    })();
  }, [queue, queryClient]);

  const hasItems = queue.length > 0;
  const anyUploading = queue.some((q) => q.status === "uploading" || q.status === "queued");
  const anyDone = queue.some((q) => q.status === "done");

  return (
    <Card className="overflow-hidden border-dashed bg-card/50">
      <div
        className={cn(
          "relative p-8 md:p-10 transition-all duration-200",
          dragActive ? "bg-primary/5 border-primary" : "hover:bg-muted/30",
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.csv,.xlsx,.txt"
          multiple
          onChange={handleChange}
          className="hidden"
        />

        {!hasItems ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-2">
              <UploadCloud className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium tracking-tight">
                Upload financial documents
              </h3>
              <p className="text-muted-foreground text-sm">
                Drop one or more files here, or click to browse. We'll analyze them in the background.
              </p>
            </div>
            <div className="text-xs text-muted-foreground/80 mt-2">
              Supports PDF, Word, CSV, XLSX, and TXT &middot; up to 10MB each
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Select files
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {queue.length} file{queue.length === 1 ? "" : "s"} in queue
                {anyUploading && (
                  <span className="text-muted-foreground font-normal ml-2">
                    &middot; analyzing...
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {anyDone && (
                  <Button variant="ghost" size="sm" onClick={clearFinished}>
                    Clear done
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  Add more
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {queue.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function QueueRow({
  item,
  onRemove,
}: {
  item: QueueItem;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-background border rounded-lg">
      <div
        className={cn(
          "w-9 h-9 rounded flex items-center justify-center shrink-0",
          item.status === "done"
            ? "bg-emerald-500/10 text-emerald-600"
            : item.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
        )}
      >
        {item.status === "done" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : item.status === "error" ? (
          <AlertCircle className="w-4 h-4" />
        ) : item.status === "uploading" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileIcon className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(item.file.size)}
          {item.status === "uploading" && (
            <span className="ml-2">&middot; analyzing...</span>
          )}
          {item.status === "queued" && (
            <span className="ml-2">&middot; queued</span>
          )}
          {item.status === "error" && item.error && (
            <span className="ml-2 text-destructive">&middot; {item.error}</span>
          )}
        </p>
        {item.status === "uploading" && (
          <Progress value={undefined} className="h-1 mt-1.5" />
        )}
      </div>
      {item.status === "done" && item.analysisId != null ? (
        <Link href={`/analyses/${item.analysisId}`}>
          <Button size="sm" variant="ghost" className="text-primary">
            Open
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      ) : item.status === "uploading" ? null : (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
          aria-label="Remove from queue"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
