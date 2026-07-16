// =============================================================================
// PERIOD MATH  —  Calendar vs Financial Year windowing
// =============================================================================
// A "period" is a 12-month window a set of months rolls up into. Two modes:
//   - calendar: Jan–Dec, anchored on the year (anchor 2025 = 2025-01..2025-12)
//   - fiscal:   Apr–Mar, anchored on the START year (anchor 2025 = 2025-04..2026-03)
// Everything keys off the canonical "YYYY-MM" month strings the matrix uses,
// so switching modes is purely a re-bucketing of the same underlying data —
// no schema or transaction change involved.

export type PeriodMode = 'calendar' | 'fiscal';

/** The anchor year the given "YYYY-MM" month belongs to under a mode. */
export function periodAnchor(monthKey: string, mode: PeriodMode): number {
  const [y, m] = monthKey.split('-').map(Number);
  // Jan–Mar belong to the PREVIOUS fiscal year (which started last April).
  if (mode === 'fiscal') return m >= 4 ? y : y - 1;
  return y;
}

/** The 12 canonical month keys of a period, in display order. */
export function periodMonths(anchor: number, mode: PeriodMode): string[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (mode === 'fiscal') {
    // Apr..Dec of the anchor year, then Jan..Mar of the next.
    const order = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    return order.map((m, i) => `${i < 9 ? anchor : anchor + 1}-${pad(m)}`);
  }
  return Array.from({ length: 12 }, (_, i) => `${anchor}-${pad(i + 1)}`);
}

/** Human label, single-year style: fiscal 2025 → "FY 2025" (Apr'25–Mar'26). */
export function periodLabel(anchor: number, mode: PeriodMode): string {
  return mode === 'fiscal' ? `FY ${anchor}` : `${anchor}`;
}

/** Longer label for tooltips/subtitles, e.g. "Apr 2025 – Mar 2026". */
export function periodRange(anchor: number, mode: PeriodMode): string {
  const months = periodMonths(anchor, mode);
  const fmt = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return `${new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })} ${y}`;
  };
  return `${fmt(months[0])} – ${fmt(months[months.length - 1])}`;
}
