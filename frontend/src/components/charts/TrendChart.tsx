import { useCallback, useMemo, useState } from 'react';
import { area, curveMonotoneX, line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { formatAmount, formatCompactINR } from '@/utils/format';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, useHiddenSeries } from './ChartLegend';
import { TooltipLayer } from './TooltipLayer';
import { AxisBottomIndex, AxisLeft, GridRows } from './axis';
import { surfaceColor } from './palette';
import { useChartMode } from './useChartMode';
import { useParentWidth } from './useParentWidth';
import { useReducedMotion } from './useReducedMotion';
import styles from './TrendChart.module.scss';

export interface TrendSeries {
  label: string;
  color: string;
  values: number[];
  /** Fill the area under the line (use for the primary series). */
  area?: boolean;
}

interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
  height?: number;
}

const MARGIN = { top: 12, right: 58, bottom: 30, left: 56 };
const MIN_LABEL_GAP = 13; // px between de-collided end labels

const gradId = (label: string) => `trend-area-${label.replace(/\W/g, '')}`;

/**
 * Push overlapping end-labels apart, keeping their original order. A label that
 * had to move gets a leader line back to its point, so it never detaches from
 * the series it belongs to.
 */
function spreadLabels(ys: number[], gap: number, bounds: [number, number]): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const out = new Array<number>(ys.length);
  let prev = -Infinity;
  for (const { y, i } of order) {
    const placed = Math.max(y, prev + gap);
    out[i] = placed;
    prev = placed;
  }
  const overflow = Math.max(...out) - bounds[1];
  if (overflow > 0) for (let i = 0; i < out.length; i++) out[i] -= overflow;
  const under = bounds[0] - Math.min(...out);
  if (under > 0) for (let i = 0; i < out.length; i++) out[i] += under;
  return out;
}

/** Multi-series line/area chart for monthly trends. Scales to its container. */
export function TrendChart({ labels, series, height = 260 }: TrendChartProps) {
  const mode = useChartMode();
  const surface = surfaceColor(mode);
  const reduced = useReducedMotion();
  const { hidden, toggle } = useHiddenSeries();
  const { ref, width } = useParentWidth();
  const [active, setActive] = useState<{ index: number; y: number } | null>(null);

  const visible = useMemo(() => series.filter((s) => !hidden.has(s.label)), [series, hidden]);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  // Scale to the visible series only — hiding the big one lets the small ones
  // fill the plot, which is the point of a toggleable legend.
  const { yScale, xScale } = useMemo(() => {
    const all = visible.flatMap((s) => s.values);
    const rawMax = all.length ? Math.max(...all, 0) : 1;
    const rawMin = all.length ? Math.min(...all, 0) : 0;
    const max = rawMax === rawMin ? rawMax + 1 : rawMax;
    return {
      yScale: scaleLinear().domain([rawMin, max]).range([innerH, 0]).nice(),
      xScale: scaleLinear()
        .domain([0, Math.max(1, labels.length - 1)])
        .range([0, innerW]),
    };
  }, [visible, innerW, innerH, labels.length]);

  const { linePath, areaPath } = useMemo(
    () => ({
      linePath: line<number>()
        .x((_, i) => xScale(i))
        .y((d) => yScale(d))
        .curve(curveMonotoneX),
      areaPath: area<number>()
        .x((_, i) => xScale(i))
        .y0(yScale(yScale.domain()[0]))
        .y1((d) => yScale(d))
        .curve(curveMonotoneX),
    }),
    [xScale, yScale],
  );

  // Pointer anywhere in the plot snaps to the nearest month — the reader aims
  // at a date, never at a 2px line.
  const handleMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (labels.length === 0) return;
      const box = event.currentTarget.getBoundingClientRect();
      const i = Math.max(
        0,
        Math.min(labels.length - 1, Math.round(xScale.invert(event.clientX - box.left))),
      );
      setActive({ index: i, y: event.clientY - box.top + MARGIN.top });
    },
    [labels.length, xScale],
  );

  // Endpoint values, de-collided. These are the secondary encoding that lets
  // the palette's colorblind separation sit in its floor band — identity never
  // rests on hue alone.
  const endLabels = useMemo(() => {
    if (!visible.length || !labels.length || innerH <= 0) return [];
    const raw = visible.map((s) => yScale(s.values[s.values.length - 1] ?? 0));
    const placed = spreadLabels(raw, MIN_LABEL_GAP, [8, innerH]);
    return visible.map((s, i) => ({
      label: s.label,
      color: s.color,
      value: formatCompactINR(s.values[s.values.length - 1] ?? 0),
      y: raw[i],
      labelY: placed[i],
    }));
  }, [visible, yScale, innerH, labels.length]);

  const all = series.flatMap((s) => s.values);
  if (all.length === 0) return <p className={styles.empty}>No data to chart yet.</p>;

  const yTicks = yScale.ticks(innerW < 420 ? 3 : 4);
  // Thin out month ticks on narrow cards rather than letting them collide.
  const xStep = Math.max(1, Math.ceil(labels.length / (innerW < 420 ? 4 : innerW < 620 ? 6 : 12)));

  return (
    <div className={styles.wrap}>
      <ChartLegend
        entries={series.map((s) => ({ label: s.label, color: s.color, shape: 'line' as const }))}
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
            aria-label={`Monthly trend of ${series.map((s) => s.label).join(', ')}`}
          >
            <defs>
              {series.map((s) => (
                <linearGradient key={s.label} id={gradId(s.label)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>

            <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
              <GridRows scale={yScale} width={innerW} ticks={yTicks} className={styles.grid} />

              {yScale.domain()[0] < 0 && (
                <line x1={0} x2={innerW} y1={yScale(0)} y2={yScale(0)} className={styles.zero} />
              )}

              {visible.map((s) => (
                <g key={s.label}>
                  {s.area && <path d={areaPath(s.values) ?? undefined} fill={`url(#${gradId(s.label)})`} />}
                  <path
                    d={linePath(s.values) ?? undefined}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {/* Crosshair + the points it snapped to */}
              {active && (
                <g>
                  <line
                    x1={xScale(active.index)}
                    x2={xScale(active.index)}
                    y1={0}
                    y2={innerH}
                    className={styles.crosshair}
                  />
                  {visible.map((s) => (
                    <circle
                      key={s.label}
                      cx={xScale(active.index)}
                      cy={yScale(s.values[active.index] ?? 0)}
                      r={4.5}
                      fill={s.color}
                      stroke={surface}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )}

              {/* Direct end-labels: the value each line finishes on */}
              {endLabels.map((e) => (
                <g key={e.label}>
                  {Math.abs(e.labelY - e.y) > 1 && (
                    <line
                      x1={innerW + 5}
                      y1={e.y}
                      x2={innerW + 10}
                      y2={e.labelY - 3}
                      className={styles.leader}
                    />
                  )}
                  <circle cx={innerW} cy={e.y} r={3.5} fill={e.color} stroke={surface} strokeWidth={2} />
                  <text x={innerW + 12} y={e.labelY} className={styles.endLabel}>
                    {e.value}
                  </text>
                </g>
              ))}

              <AxisLeft scale={yScale} ticks={yTicks} format={formatCompactINR} className={styles.tick} />
              <AxisBottomIndex
                scale={xScale}
                labels={labels}
                step={xStep}
                top={innerH}
                className={styles.tick}
              />

              {/* One transparent hit layer — the pointer never has to find a line */}
              <rect
                width={innerW}
                height={innerH}
                fill="transparent"
                onPointerMove={handleMove}
                onPointerLeave={() => setActive(null)}
              />
            </g>
          </svg>
        )}

        {active && (
          <TooltipLayer
            left={MARGIN.left + xScale(active.index)}
            top={active.y}
            containerWidth={width}
          >
            <ChartTooltip
              title={labels[active.index]}
              rows={visible.map((s) => ({
                label: s.label,
                value: `₹${formatAmount(s.values[active.index] ?? 0)}`,
                color: s.color,
                line: true,
              }))}
            />
          </TooltipLayer>
        )}
      </div>
    </div>
  );
}
