// Shared categorical color palette for charts — built around the theme's
// Electric Blue + Investment purple, extended with harmonized hues.
export const CHART_COLORS = [
  '#0052ff', // accent blue
  '#7c5cff', // investment purple
  '#0f9d58', // positive green
  '#f5a623', // amber
  '#e5484d', // red
  '#00b8d9', // cyan
  '#ff7a59', // coral
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#eab308', // gold
];

export const colorAt = (i: number) => CHART_COLORS[i % CHART_COLORS.length];
