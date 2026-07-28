import { useAppSelector } from '@/store/hooks';
import type { ChartMode } from './palette';

/**
 * Which palette the charts should draw with. Dark mode gets its own validated
 * steps rather than an automatic flip, so the charts have to know the theme —
 * SVG fills can't read a CSS custom property from a presentation attribute,
 * and gradient stops need real values anyway.
 */
export function useChartMode(): ChartMode {
  return useAppSelector((s) => s.ui.theme);
}
