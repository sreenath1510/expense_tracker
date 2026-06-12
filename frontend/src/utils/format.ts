// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/** Format a number as INR with no decimals, e.g. 26000 -> "₹26,000". */
export function formatCurrency(value: number): string {
  if (value === 0) return '—'; // empty cells read cleaner as a dash, like the Excel
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact INR for tight cells, e.g. 26000 -> "26,000" (no symbol). */
export function formatAmount(value: number): string {
  if (value === 0) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

/** Compact INR for chart axes/labels: 1250 -> "₹1.3K", 250000 -> "₹2.5L". */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** "2025-01" -> { label: "Jan", year: "2025" } */
export function formatMonthKey(key: string): { label: string; year: string } {
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return {
    label: date.toLocaleString('en-US', { month: 'short' }),
    year,
  };
}

/** Today's date as ISO yyyy-mm-dd, for date input defaults. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Format a date for ledger rows as "Mmm dd, Day" — e.g. "May 14, Wed".
 * Accepts ISO 'YYYY-MM-DD'; if the string isn't a parseable date (e.g. a
 * raw token from a messy PDF), it's returned unchanged.
 */
export function formatLedgerDate(value: string): string {
  const iso = value?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  const weekday = d.toLocaleString('en-US', { weekday: 'short' });
  return `${month} ${day}, ${weekday}`;
}
