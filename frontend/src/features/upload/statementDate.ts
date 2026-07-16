// =============================================================================
// STATEMENT DATE NORMALIZATION
// =============================================================================
// Banks export dates in whatever format they like — "24/04/26", "01-Feb-2025",
// "2025-02-01". Everything downstream needs ISO YYYY-MM-DD: the batch API's
// txnDate is a real date, and formatLedgerDate() only prettifies ISO. So every
// parser normalizes here, once, at parse time.
//
// Day-first is the default reading ("24/04/26" -> 2026-04-24), matching Indian
// bank statements. A two-digit year maps to 20YY.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO string for a real calendar date, or null (rejects e.g. 31/02). */
function build(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** True when the value is already a valid ISO calendar date. */
export function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  return !!m && build(Number(m[1]), Number(m[2]), Number(m[3])) !== null;
}

/**
 * Normalize a statement date to ISO YYYY-MM-DD, or null when it can't be read.
 * Accepts YYYY-MM-DD, D/M/Y, D-M-Y, D.M.Y and D-Mon-Y (any 2- or 4-digit year).
 */
export function toIsoDate(raw: string): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // Year-first: 2025-02-01 / 2025/02/01
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (ymd) return build(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));

  // Day-first: 24/04/26, 01-Feb-2025, 1.2.2025, 01 Feb 25
  const dmy = /^(\d{1,2})[-/.\s]([A-Za-z]{3,9}|\d{1,2})[-/.\s](\d{2,4})$/.exec(s);
  if (!dmy) return null;

  let year = Number(dmy[3]);
  if (dmy[3].length === 2) year += 2000;

  const first = Number(dmy[1]);
  const monthToken = dmy[2];

  if (/^[A-Za-z]+$/.test(monthToken)) {
    const month = MONTHS[monthToken.slice(0, 3).toLowerCase()];
    return month ? build(year, month, first) : null;
  }

  const second = Number(monthToken);
  // Only read it month-first when day-first is impossible (US-style exports).
  if (first <= 12 && second > 12) return build(year, first, second);
  return build(year, second, first);
}
