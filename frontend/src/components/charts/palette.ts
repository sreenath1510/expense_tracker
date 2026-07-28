// =============================================================================
// CHART PALETTE  —  validated, per-mode
// =============================================================================
// Chart color is a separate system from the UI tokens, and it is *computed*,
// not hand-picked. Both arrays below clear all six checks of the categorical
// palette standard (lightness band, chroma floor, colorblind separation,
// normal-vision floor, contrast vs the card surface) against this app's own
// surfaces — #ffffff light, #121b2e dark:
//
//   light  CVD ΔE 11.3 (deutan) · normal ΔE 20.3 · all 8 ≥ 3:1
//   dark   CVD ΔE 11.3 (deutan) · normal ΔE 20.3 · all 8 ≥ 3:1
//
// The previous palette failed: it put the accent blue next to the investment
// purple, which collapsed to ΔE 3.0 under protanopia and only 12.6 for normal
// vision — the two were genuinely hard to tell apart in the donut and on the
// trend lines.
//
// THE ORDER IS THE SAFETY MECHANISM. Slots are assigned in sequence and never
// cycled or re-sorted; re-ordering these arrays invalidates the separation
// guarantee. A ninth category folds into "Other" rather than getting a color.

export type ChartMode = 'light' | 'dark';

const LIGHT = [
  '#0052ff', // 1 · blue      — the brand accent, and expenditure
  '#0f9d58', // 2 · green     — income
  '#7c3aed', // 3 · purple    — investments
  '#e5484d', // 4 · red
  '#0891b2', // 5 · cyan
  '#d97706', // 6 · amber
  '#db2777', // 7 · pink
  '#65a30d', // 8 · lime
] as const;

// Dark isn't an automatic flip: slot 1 steps up to the lighter blue the app
// already uses as its dark-mode accent, which is what carries it past 3:1 on
// the dark card. The other seven hold their step — each still passes there.
const DARK = [
  '#4d7cff',
  '#0f9d58',
  '#7c3aed',
  '#e5484d',
  '#0891b2',
  '#d97706',
  '#db2777',
  '#65a30d',
] as const;

export const chartColors = (mode: ChartMode): readonly string[] =>
  mode === 'dark' ? DARK : LIGHT;

/** Slot `i` of the fixed order, wrapping only past the documented eight. */
export const colorAt = (i: number, mode: ChartMode = 'light') => {
  const colors = chartColors(mode);
  return colors[i % colors.length];
};

/**
 * The three recurring series. These are identity, not status — "expenditure"
 * isn't bad and "income" isn't good — so they take categorical slots rather
 * than the reserved positive/negative status tokens.
 */
export const seriesColors = (mode: ChartMode) => {
  const c = chartColors(mode);
  return { expenditure: c[0], income: c[1], investment: c[2] };
};

/**
 * A budget is a reference line, not a category, so it wears neutral gray and
 * leaves the identity channel to the actual spend beside it.
 */
export const budgetColor = (mode: ChartMode) => (mode === 'dark' ? '#64748b' : '#94a3b8');

/** Surface the marks sit on — the 2px gaps and rings are painted in it. */
export const surfaceColor = (mode: ChartMode) => (mode === 'dark' ? '#121b2e' : '#ffffff');
