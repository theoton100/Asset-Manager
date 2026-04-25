import { useEffect, useRef, useState } from "react";
import { useChatWithAnalysis } from "@workspace/api-client-react";
import type { ChatMessage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, X, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  analysisId: number;
  analysisTitle: string;
};

const SUGGESTIONS = [
  "Summarize this in one paragraph",
  "What's the biggest risk here?",
  "Which metric matters most?",
  "How reliable is the forecast?",
];

export function AnalysisChat({ analysisId, analysisTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useChatWithAnalysis();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatMutation.isPending]);

  // Reset conversation when navigating between analyses
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [analysisId]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || chatMutation.isPending) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    try {
      const response = await chatMutation.mutateAsync({
        id: analysisId,
        data: { messages: next },
      });
      setMessages([
        ...next,
        { role: "assistant", content: response.reply },
      ]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `Sorry — ${err.message}`
              : "Sorry, something went wrong.",
        },
      ]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center",
          "h-14 w-14 rounded-full shadow-lg shadow-primary/25",
          "bg-primary text-primary-foreground",
          "transition-all duration-200 hover:scale-105 hover:shadow-xl",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          open && "scale-95",
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-50 w-[min(420px,calc(100vw-3rem))]",
          "h-[min(620px,calc(100vh-8rem))]",
          "flex flex-col rounded-2xl border bg-background shadow-2xl",
          "transition-all duration-200 origin-bottom-right",
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-2 pointer-events-none",
        )}
        role="dialog"
        aria-label="Chat about analysis"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              Ask about this analysis
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {analysisTitle}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                I can answer questions grounded in this analysis — its
                metrics, time series, forecasts, and source text. Try one of
                these to start:
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="text-left text-sm px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/60 hover:border-primary/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}

          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-3 text-sm flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2 rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 transition">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground max-h-32"
              disabled={chatMutation.isPending}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => void send(input)}
              disabled={!input.trim() || chatMutation.isPending}
              className="m-1 h-8 w-8 text-primary hover:text-primary"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
