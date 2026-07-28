import { useMemo, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { formatAmount, formatCompactINR } from '@/utils/format';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, useHiddenSeries } from './ChartLegend';
import { TooltipLayer } from './TooltipLayer';
import { AxisBottomBand, AxisLeft, GridRows } from './axis';
import { useParentWidth } from './useParentWidth';
import { useReducedMotion } from './useReducedMotion';
import styles from './BarChart.module.scss';

export interface BarSeries {
  label: string;
  color: string;
}

interface BarGroup {
  label: string;
  values: number[]; // one per series
}

interface BarChartProps {
  groups: BarGroup[];
  series: BarSeries[];
  height?: number;
}

const MARGIN = { top: 14, right: 8, bottom: 34, left: 56 };
const MAX_BAR = 24; // never let a bar fill its slot — the leftover is air
const GAP = 2; // surface gap between touching bars
const RADIUS = 4; // rounded data-end, square at the baseline

const gradId = (label: string) => `bar-grad-${label.replace(/\W/g, '')}`;

/** Rounded at the top only: the baseline end stays square where it's anchored. */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const b = y + h;
  return `M${x},${b} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${
    x + w
  },${y + rr} L${x + w},${b} Z`;
}

interface Hovered {
  group: string;
  seriesIndex: number;
  x: number;
  y: number;
}

/** Grouped vertical bars — budget vs actual, or income vs spend across years. */
export function BarChart({ groups, series, height = 260 }: BarChartProps) {
  const reduced = useReducedMotion();
  const { hidden, toggle } = useHiddenSeries();
  const { ref, width } = useParentWidth();
  const [hover, setHover] = useState<Hovered | null>(null);

  const visibleIdx = useMemo(
    () => series.map((s, i) => (hidden.has(s.label) ? -1 : i)).filter((i) => i >= 0),
    [series, hidden],
  );

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { xScale, yScale, barW } = useMemo(() => {
    const shown = groups.flatMap((g) => visibleIdx.map((i) => g.values[i] ?? 0));
    const max = shown.length ? Math.max(...shown, 1) : 1;
    const x = scaleBand<string>()
      .domain(groups.map((g) => g.label))
      .range([0, innerW])
      .padding(0.28);
    const n = Math.max(1, visibleIdx.length);
    const w = Math.min(MAX_BAR, (x.bandwidth() - GAP * (n - 1)) / n);
    return {
      xScale: x,
      yScale: scaleLinear().domain([0, max]).range([innerH, 0]).nice(),
      barW: Math.max(1, w),
    };
  }, [groups, visibleIdx, innerW, innerH]);

  const all = groups.flatMap((g) => g.values);
  if (all.length === 0) return <p className={styles.empty}>No data to chart yet.</p>;

  const yTicks = yScale.ticks(innerH < 200 ? 3 : 4);
  const bandW = xScale.bandwidth();
  const runW = barW * visibleIdx.length + GAP * Math.max(0, visibleIdx.length - 1);
  const hotGroup = hover ? groups.find((g) => g.label === hover.group) : null;

  return (
    <div className={styles.wrap}>
      <ChartLegend
        entries={series.map((s) => ({ label: s.label, color: s.color, shape: 'rect' as const }))}
        hidden={hidden}
        onToggle={toggle}
      />
      <div ref={ref} className={styles.plot} style={{ height }}>
        {width > 10 && (
          <svg
            width={width}
            height={height}
            className={`${styles.svg} ${reduced ? '' : styles.animated}`}
            role="img"
            aria-label={`${series.map((s) => s.label).join(' vs ')} by category`}
          >
            <defs>
              {/* Decoration inside one mark, not an encoding: the same hue,
                  top slightly lifted, bottom at full strength. It never varies
                  between bars, so it can't be read as a value ramp. */}
              {series.map((s) => (
                <linearGradient key={s.label} id={gradId(s.label)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.78} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>

            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              <GridRows scale={yScale} width={innerW} ticks={yTicks} className={styles.grid} />

              {groups.map((g) => {
                const start = (xScale(g.label) ?? 0) + (bandW - runW) / 2;
                return (
                  <g key={g.label}>
                    {visibleIdx.map((si, k) => {
                      const v = g.values[si] ?? 0;
                      const y = yScale(v);
                      const barH = Math.max(0, innerH - y);
                      const x = start + k * (barW + GAP);
                      const isHot = hover?.group === g.label && hover?.seriesIndex === si;
                      return (
                        <g
                          key={si}
                          className={styles.barHit}
                          onPointerEnter={() =>
                            setHover({
                              group: g.label,
                              seriesIndex: si,
                              x: MARGIN.left + x + barW / 2,
                              y: MARGIN.top + y,
                            })
                          }
                          onPointerLeave={() => setHover(null)}
                        >
                          {/* Hit target spans the full column height and the
                              gap, so a near-zero bar is still easy to point at. */}
                          <rect
                            x={x - GAP}
                            y={0}
                            width={barW + GAP * 2}
                            height={innerH}
                            fill="transparent"
                          />
                          <path
                            d={barPath(x, y, barW, barH, RADIUS)}
                            fill={`url(#${gradId(series[si].label)})`}
                            className={`${styles.bar} ${isHot ? styles.barHot : ''} ${
                              hover && !isHot ? styles.barDim : ''
                            }`}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              <AxisLeft scale={yScale} ticks={yTicks} format={formatCompactINR} className={styles.tick} />
              <AxisBottomBand scale={xScale} top={innerH} className={styles.tick} />
            </g>
          </svg>
        )}

        {hover && hotGroup && (
          <TooltipLayer left={hover.x} top={hover.y} containerWidth={width}>
            <ChartTooltip
              title={hover.group}
              rows={visibleIdx.map((si) => ({
                label: series[si].label,
                value: `₹${formatAmount(hotGroup.values[si] ?? 0)}`,
                color: series[si].color,
              }))}
            />
          </TooltipLayer>
        )}
      </div>
    </div>
  );
}
