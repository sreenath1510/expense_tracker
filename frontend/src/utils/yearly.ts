// =============================================================================
// YEARLY AGGREGATION  —  derive per-year views from the matrix
// =============================================================================
// The /matrix payload already carries every month's numbers, so the entire
// yearly dashboard (year cards, trends, breakdowns) is computed here on the
// client — no extra endpoint needed. Everything keys off the canonical
// "YYYY-MM" month strings.

import type { MatrixResponse } from '@/types';

export interface YearSummary {
  year: string;
  months: string[]; // month keys in this year, ascending
  income: number;
  expenditure: number;
  investments: number;
  balance: number; // income − expenditure − investments
  savingsRate: number; // balance / income (0..1), 0 when no income
  monthlyBalance: number[]; // balance per month, for a sparkline
}

export interface MonthlySeries {
  labels: string[]; // "Jan", "Feb", …
  monthKeys: string[];
  income: number[];
  expenditure: number[];
  investments: number[];
  balance: number[];
}

export interface BlockSlice {
  label: string;
  value: number;
  type: 'EXPENSE' | 'INVESTMENT';
}

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleString('en-US', { month: 'short' });

/** Distinct years present in the matrix, most recent first. */
export function getYears(matrix: MatrixResponse): string[] {
  const set = new Set(matrix.months.map((m) => m.slice(0, 4)));
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function getYearMonths(matrix: MatrixResponse, year: string): string[] {
  return matrix.months.filter((m) => m.startsWith(year)).sort();
}

const sum = (obj: Record<string, number>, keys: string[]) =>
  keys.reduce((acc, k) => acc + (obj[k] ?? 0), 0);

export function getYearSummaries(matrix: MatrixResponse): YearSummary[] {
  return getYears(matrix).map((year) => {
    const months = getYearMonths(matrix, year);
    const income = sum(matrix.summary.totalIncome, months);
    const expenditure = sum(matrix.summary.totalExpenditure, months);
    const investments = sum(matrix.summary.totalInvestments, months);
    const balance = income - expenditure - investments;
    return {
      year,
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

/** Monthly series for one year, for the trend chart. */
export function getMonthlySeries(matrix: MatrixResponse, year: string): MonthlySeries {
  const monthKeys = getYearMonths(matrix, year);
  return {
    monthKeys,
    labels: monthKeys.map(monthLabel),
    income: monthKeys.map((m) => matrix.summary.totalIncome[m] ?? 0),
    expenditure: monthKeys.map((m) => matrix.summary.totalExpenditure[m] ?? 0),
    investments: monthKeys.map((m) => matrix.summary.totalInvestments[m] ?? 0),
    balance: monthKeys.map((m) => matrix.summary.balance[m] ?? 0),
  };
}

/** Per-block totals for one year (drives the category donut). */
export function getBlockBreakdown(matrix: MatrixResponse, year: string): BlockSlice[] {
  const months = getYearMonths(matrix, year);
  return matrix.blocks
    .map((b) => ({
      label: b.blockName,
      value: sum(b.subtotals, months),
      type: b.blockType,
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Build a MatrixResponse restricted to a single year's month columns. */
export function sliceMatrixByYear(matrix: MatrixResponse, year: string): MatrixResponse {
  const months = getYearMonths(matrix, year);
  const pick = (obj: Record<string, number>) =>
    Object.fromEntries(months.map((m) => [m, obj[m] ?? 0]));
  return {
    months,
    blocks: matrix.blocks.map((b) => ({
      ...b,
      rows: b.rows.map((r) => ({ ...r, cells: pick(r.cells) })),
      subtotals: pick(b.subtotals),
    })),
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
