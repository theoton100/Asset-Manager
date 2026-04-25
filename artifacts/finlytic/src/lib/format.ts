const KNOWN_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "CAD",
  "AUD",
  "CHF",
  "GHS",
  "NGN",
  "ZAR",
  "INR",
  "KES",
  "EGP",
  "MAD",
  "XOF",
  "XAF",
  "BRL",
  "MXN",
  "AED",
  "SAR",
]);

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₦": "NGN",
  "₵": "GHS",
  "GH₵": "GHS",
  "₹": "INR",
  "R$": "BRL",
};

function isCurrencyUnit(unit: string): string | null {
  const u = unit.trim();
  if (!u) return null;
  const upper = u.toUpperCase();
  if (KNOWN_CURRENCIES.has(upper)) return upper;
  if (SYMBOL_TO_CURRENCY[u]) return SYMBOL_TO_CURRENCY[u];
  if (SYMBOL_TO_CURRENCY[upper]) return SYMBOL_TO_CURRENCY[upper];
  return null;
}

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    ...opts,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return formatNumber(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a value with its unit. Currencies use Intl.NumberFormat to produce
 * proper symbols (e.g. GHS 108,100 -> "GH₵ 108,100", USD -> "$108,100").
 */
export function formatValue(
  value: number,
  unit: string | null | undefined,
): string {
  if (!Number.isFinite(value)) return "—";
  if (!unit) return formatNumber(value);
  const u = unit.trim();
  if (!u) return formatNumber(value);

  // Percentages
  if (u === "%" || u.toLowerCase() === "percent") {
    return `${formatNumber(value)}%`;
  }

  // Currency
  const code = isCurrencyUnit(u);
  if (code) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
      }).format(value);
    } catch {
      return `${formatNumber(value)} ${code}`;
    }
  }

  // Plain unit
  return `${formatNumber(value)} ${u}`;
}

/** Compact value for axis ticks etc. */
export function formatValueCompact(
  value: number,
  unit: string | null | undefined,
): string {
  if (!Number.isFinite(value)) return "—";
  const code = unit ? isCurrencyUnit(unit) : null;
  if (code) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    } catch {
      return `${formatCompact(value)} ${code}`;
    }
  }
  if (unit && unit.trim() === "%") return `${formatCompact(value)}%`;
  if (unit && unit.trim()) return `${formatCompact(value)} ${unit}`;
  return formatCompact(value);
}
