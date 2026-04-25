import { useState, useCallback, useRef } from "react";
import { UploadCloud, File, AlertCircle, CheckCircle2 } from "lucide-react";
import { useUploadAnalysis, getListAnalysesQueryKey, getGetAnalysesStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  "text/plain"
];

export function FileUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const uploadMutation = useUploadAnalysis({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAnalysesStatsQueryKey() });
        setLocation(`/analyses/${data.id}`);
      }
    }
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (ALLOWED_TYPES.includes(file.type) || file.name.match(/\.(pdf|docx?|csv|xlsx|txt)$/i)) {
        setSelectedFile(file);
      }
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  }, []);

  const handleSubmit = () => {
    if (!selectedFile) return;
    uploadMutation.mutate({
      data: {
        file: selectedFile,
        horizon: 6
      }
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <Card className="overflow-hidden border-dashed bg-card/50">
      <div
        className={cn(
          "relative p-8 md:p-12 text-center transition-all duration-200",
          dragActive ? "bg-primary/5 border-primary" : "hover:bg-muted/50",
          uploadMutation.isPending && "opacity-80 pointer-events-none"
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
          onChange={handleChange}
          className="hidden"
        />

        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <UploadCloud className="w-8 h-8 text-primary animate-bounce" />
            </div>
            <h3 className="text-xl font-medium tracking-tight">Analyzing document...</h3>
            <p className="text-muted-foreground max-w-sm mx-auto text-sm">
              Our AI is extracting key metrics, generating forecasts, and drafting insights. This usually takes 10-30 seconds.
            </p>
            <div className="w-full max-w-xs mt-6">
              <Progress value={undefined} className="h-2" />
            </div>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="flex items-center gap-4 p-4 bg-background border rounded-xl w-full max-w-md shadow-sm">
              <div className="w-12 h-12 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <File className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            </div>

            {uploadMutation.isError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg max-w-md w-full">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadMutation.error?.error || "An error occurred during upload."}</span>
              </div>
            )}

            <Button size="lg" onClick={handleSubmit} className="w-full max-w-md shadow-sm">
              Run Analysis
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-2">
              <UploadCloud className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium tracking-tight">Upload financial document</h3>
              <p className="text-muted-foreground text-sm">
                Drag and drop your file here, or click to browse
              </p>
            </div>
            <div className="text-xs text-muted-foreground/80 mt-2">
              Supports PDF, Word, CSV, XLSX, and TXT
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              Select File
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
