// =============================================================================
// BUDGETS  —  carry-forward resolution
// =============================================================================
// Budgets are stored sparsely (one row per block per month the user set). The
// "effective" budget for any month is the most recent explicitly-set value at
// or before that month — so a value set once recurs until changed, while a new
// row overrides from its month onward.

import type { Budget } from '@/types';

const rank = (year: number, month: number) => year * 12 + (month - 1);

/** Effective monthly budget for a block in "YYYY-MM", or null if never set. */
export function effectiveBudget(
  budgets: Budget[],
  blockId: number,
  monthKey: string,
): number | null {
  const [y, m] = monthKey.split('-').map(Number);
  const target = rank(y, m);
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.blockId !== blockId) continue;
    if (rank(b.year, b.month) > target) continue; // future override doesn't apply
    if (!best || rank(b.year, b.month) > rank(best.year, best.month)) best = b;
  }
  return best ? best.amount : null;
}

/** Sum of effective monthly budgets across a set of month keys (annual total). */
export function annualBudget(
  budgets: Budget[],
  blockId: number,
  monthKeys: string[],
): number {
  return monthKeys.reduce((sum, mk) => sum + (effectiveBudget(budgets, blockId, mk) ?? 0), 0);
}
