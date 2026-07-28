// =============================================================================
// PERIOD AGGREGATION  —  derive per-period views from the matrix
// =============================================================================
// The /matrix payload carries every month's numbers, so the entire dashboard
// (period cards, trends, breakdowns, the sliced pivot) is computed here on the
// client — one cached fetch feeds every screen. Everything buckets months into
// periods (calendar Jan–Dec or fiscal Apr–Mar) via utils/period, so the CY/FY
// toggle is a pure re-derivation with no extra requests.

import type { MatrixResponse } from '@/types';
import {
  periodAnchor,
  periodLabel,
  periodMonths,
  type PeriodMode,
} from './period';

export interface PeriodSummary {
  anchor: number; // e.g. 2025
  label: string; // "FY 2025" or "2025"
  months: string[]; // month keys in this period that have data, ascending
  income: number;
  expenditure: number;
  investments: number;
  balance: number; // income − expenditure − investments
  savingsRate: number; // balance / income (0..1), 0 when no income
  monthlyBalance: number[]; // balance per data-month, for a sparkline
}

export interface MonthlySeries {
  labels: string[]; // "Apr", "May", …
  monthKeys: string[];
  income: number[];
  expenditure: number[];
  investments: number[];
  balance: number[];
}

export interface BlockSlice {
  blockId: number;
  label: string;
  value: number;
  type: 'EXPENSE' | 'INVESTMENT';
  /**
   * Palette slot, taken from the block's position in the matrix — NOT from its
   * rank in this particular breakdown. A block that's the biggest one month and
   * the fourth-biggest the next keeps the same color, so "Mandatory is blue"
   * stays true across the month view, the year view and every period.
   */
  colorIndex: number;
}

/** The categorical palette has eight slots; past that, hues would repeat. */
export const MAX_SLICES = 8;

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleString('en-US', { month: 'short' });

const sum = (obj: Record<string, number>, keys: string[]) =>
  keys.reduce((acc, k) => acc + (obj[k] ?? 0), 0);

/** Distinct period anchors present in the matrix, most recent first. */
export function getPeriods(matrix: MatrixResponse, mode: PeriodMode): number[] {
  const set = new Set(matrix.months.map((m) => periodAnchor(m, mode)));
  return [...set].sort((a, b) => b - a);
}

/** The period's month keys that actually have data in the matrix, ascending. */
export function getPeriodMonths(
  matrix: MatrixResponse,
  anchor: number,
  mode: PeriodMode,
): string[] {
  const present = new Set(matrix.months);
  return periodMonths(anchor, mode).filter((m) => present.has(m));
}

export function getPeriodSummaries(
  matrix: MatrixResponse,
  mode: PeriodMode,
): PeriodSummary[] {
  return getPeriods(matrix, mode).map((anchor) => {
    const months = getPeriodMonths(matrix, anchor, mode);
    const income = sum(matrix.summary.totalIncome, months);
    const expenditure = sum(matrix.summary.totalExpenditure, months);
    const investments = sum(matrix.summary.totalInvestments, months);
    const balance = income - expenditure - investments;
    return {
      anchor,
      label: periodLabel(anchor, mode),
      months,
      income,
      expenditure,
      investments,
      balance,
      savingsRate: income > 0 ? balance / income : 0,
      monthlyBalance: months.map((m) => matrix.summary.balance[m] ?? 0),
    };
  });
}

/** Monthly series for one period, for the trend chart. */
export function getMonthlySeries(
  matrix: MatrixResponse,
  anchor: number,
  mode: PeriodMode,
): MonthlySeries {
  const monthKeys = getPeriodMonths(matrix, anchor, mode);
  return {
    monthKeys,
    labels: monthKeys.map(monthLabel),
    income: monthKeys.map((m) => matrix.summary.totalIncome[m] ?? 0),
    expenditure: monthKeys.map((m) => matrix.summary.totalExpenditure[m] ?? 0),
    investments: monthKeys.map((m) => matrix.summary.totalInvestments[m] ?? 0),
    balance: monthKeys.map((m) => matrix.summary.balance[m] ?? 0),
  };
}

/** Per-block totals for one period (drives the category donut). */
export function getBlockBreakdown(
  matrix: MatrixResponse,
  anchor: number,
  mode: PeriodMode,
): BlockSlice[] {
  const months = getPeriodMonths(matrix, anchor, mode);
  return matrix.blocks
    .map((b, i) => ({
      blockId: b.blockId,
      label: b.blockName,
      value: sum(b.subtotals, months),
      type: b.blockType,
      colorIndex: i,
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Per-block totals for a single month (drives the month view's donut). */
export function getMonthBreakdown(matrix: MatrixResponse, monthKey: string): BlockSlice[] {
  return matrix.blocks
    .map((b, i) => ({
      blockId: b.blockId,
      label: b.blockName,
      value: b.subtotals[monthKey] ?? 0,
      type: b.blockType,
      colorIndex: i,
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/**
 * Turn block slices into donut data, folding everything past the palette's
 * eight slots into a single neutral "Other" rather than repeating a hue. Blocks
 * are ordered by the user's own sort order, so which blocks get their own slice
 * is stable — it doesn't shuffle as amounts move around.
 */
export function foldToSlices(
  slices: BlockSlice[],
  colorFor: (index: number) => string,
  otherColor: string,
): { label: string; value: number; color: string }[] {
  const kept = slices.filter((s) => s.colorIndex < MAX_SLICES);
  const tail = slices.filter((s) => s.colorIndex >= MAX_SLICES);
  const out = kept.map((s) => ({
    label: s.label,
    value: s.value,
    color: colorFor(s.colorIndex),
  }));
  const tailTotal = tail.reduce((acc, s) => acc + s.value, 0);
  if (tailTotal > 0) out.push({ label: 'Other', value: tailTotal, color: otherColor });
  return out;
}

/**
 * Build a MatrixResponse restricted to one period's month columns, with
 * line-item rows that have no activity in the window pruned away (and blocks
 * that end up empty dropped). This is what keeps an old category like "EMI"
 * from showing as a column of dashes in a year it wasn't used.
 */
export function sliceMatrixByPeriod(
  matrix: MatrixResponse,
  anchor: number,
  mode: PeriodMode,
): MatrixResponse {
  const months = getPeriodMonths(matrix, anchor, mode);
  const pick = (obj: Record<string, number>) =>
    Object.fromEntries(months.map((m) => [m, obj[m] ?? 0]));

  const blocks = matrix.blocks
    .map((b) => ({
      ...b,
      rows: b.rows
        .filter((r) => months.some((m) => (r.cells[m] ?? 0) !== 0))
        .map((r) => ({ ...r, cells: pick(r.cells) })),
      subtotals: pick(b.subtotals),
    }))
    // Drop a block entirely when nothing in it has data this period.
    .filter((b) => b.rows.length > 0 || months.some((m) => b.subtotals[m] !== 0));

  return {
    months,
    blocks,
    summary: {
      totalIncome: pick(matrix.summary.totalIncome),
      totalExpenditure: pick(matrix.summary.totalExpenditure),
      balance: pick(matrix.summary.balance),
      totalInvestments: pick(matrix.summary.totalInvestments),
      liquidSavings: pick(matrix.summary.liquidSavings),
    },
    remarks: Object.fromEntries(
      months.filter((m) => matrix.remarks[m]).map((m) => [m, matrix.remarks[m]]),
    ),
  };
}
