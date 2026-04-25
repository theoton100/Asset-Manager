export type Sentiment = "positive" | "neutral" | "negative" | string;

export function sentimentBadgeClass(sentiment: Sentiment): string {
  if (sentiment === "positive") {
    return "text-emerald-600 border-emerald-200 bg-emerald-50/50 dark:text-emerald-400 dark:border-emerald-900/50 dark:bg-emerald-900/20";
  }
  if (sentiment === "negative") {
    return "text-rose-600 border-rose-200 bg-rose-50/50 dark:text-rose-400 dark:border-rose-900/50 dark:bg-rose-900/20";
  }
  return "text-slate-600 border-slate-200 bg-slate-50/50 dark:text-slate-400 dark:border-slate-800/50 dark:bg-slate-800/20";
}

export function sentimentLabel(sentiment: Sentiment): string {
  if (typeof sentiment !== "string" || sentiment.length === 0) return "Neutral";
  return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}
