import type {
  Forecast,
  ForecastPoint,
  SeriesPoint,
  TimeSeries,
} from "@workspace/db";

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = values.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (values[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function residualStd(values: number[], slope: number, intercept: number): number {
  const n = values.length;
  if (n < 2) return 0;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ss += (values[i]! - predicted) ** 2;
  }
  return Math.sqrt(ss / Math.max(1, n - 2));
}

function nextPeriodLabels(
  history: SeriesPoint[],
  count: number,
): string[] {
  // Try to detect numeric year labels first
  const last = history[history.length - 1]?.period ?? "";
  const yearMatch = last.match(/^\s*(19|20)\d{2}\s*$/);
  if (yearMatch) {
    const startYear = parseInt(last, 10);
    return Array.from({ length: count }, (_, i) => String(startYear + i + 1));
  }

  // Quarter labels like "Q1 2024"
  const qMatch = last.match(/^Q([1-4])\s*((?:19|20)\d{2})$/i);
  if (qMatch) {
    let q = parseInt(qMatch[1]!, 10);
    let year = parseInt(qMatch[2]!, 10);
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      q += 1;
      if (q > 4) {
        q = 1;
        year += 1;
      }
      out.push(`Q${q} ${year}`);
    }
    return out;
  }

  // Fallback: append "+N"
  return Array.from({ length: count }, (_, i) => `Period +${i + 1}`);
}

export function buildForecast(
  series: TimeSeries,
  horizon: number,
): Forecast | null {
  const history = series.points.filter(
    (p) => Number.isFinite(p.value) && typeof p.period === "string",
  );
  if (history.length < 3) return null;

  const values = history.map((p) => p.value);
  const { slope, intercept } = linearRegression(values);
  const sigma = residualStd(values, slope, intercept);

  const labels = nextPeriodLabels(history, horizon);
  const projection: ForecastPoint[] = labels.map((period, i) => {
    const x = history.length + i;
    const value = intercept + slope * x;
    // Confidence band widens with horizon
    const band = 1.96 * sigma * Math.sqrt(1 + (i + 1) / Math.max(1, history.length));
    return {
      period,
      value: Number(value.toFixed(4)),
      lower: Number((value - band).toFixed(4)),
      upper: Number((value + band).toFixed(4)),
    };
  });

  return {
    label: series.label,
    method: "linear-regression",
    history,
    projection,
  };
}
