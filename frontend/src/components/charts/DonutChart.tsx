import { useMemo, useState } from 'react';
import { arc as d3arc, pie as d3pie } from 'd3-shape';
import { formatAmount, formatCompactINR } from '@/utils/format';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, useHiddenSeries } from './ChartLegend';
import { TooltipLayer } from './TooltipLayer';
import { colorAt, surfaceColor } from './palette';
import { useChartMode } from './useChartMode';
import { useReducedMotion } from './useReducedMotion';
import styles from './DonutChart.module.scss';

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  centerLabel?: string;
  size?: number;
}

const THICKNESS = 26;
const HOVER_GROW = 7; // how far the hovered slice pushes outward
const PAD_ANGLE = 0.014; // opens the 2px surface gap between slices

/**
 * Part-to-whole at a glance, with a center readout that follows the pointer.
 * Slices take the categorical palette in its fixed order, bound to the entity —
 * so toggling one off never repaints the survivors.
 */
export function DonutChart({ data, centerLabel = 'Total', size = 184 }: DonutChartProps) {
  const mode = useChartMode();
  const surface = surfaceColor(mode);
  const reduced = useReducedMotion();
  const { hidden, toggle } = useHiddenSeries();
  const [active, setActive] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const withColor = useMemo(
    () => data.map((d, i) => ({ ...d, color: d.color ?? colorAt(i, mode) })),
    [data, mode],
  );

  const visible = useMemo(
    () => withColor.filter((d) => !hidden.has(d.label) && d.value > 0),
    [withColor, hidden],
  );

  const radius = size / 2;
  // Leave room for the hovered slice to grow without clipping.
  const outer = radius - HOVER_GROW;
  const inner = outer - THICKNESS;

  const arcs = useMemo(
    () =>
      d3pie<(typeof visible)[number]>()
        .value((d) => d.value)
        .sort(null)
        .sortValues(null)
        .padAngle(PAD_ANGLE)(visible),
    [visible],
  );

  const total = visible.reduce((s, d) => s + d.value, 0);
  const grandTotal = withColor.reduce((s, d) => s + d.value, 0);

  if (grandTotal <= 0) return <p className={styles.empty}>No data to chart yet.</p>;

  const activeDatum = active ? visible.find((d) => d.label === active) ?? null : null;
  const centerValue = activeDatum ? activeDatum.value : total;
  const centerText = activeDatum ? activeDatum.label : centerLabel;

  return (
    <div className={styles.wrap}>
      <div className={styles.plot} style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className={`${styles.svg} ${reduced ? '' : styles.animated}`}
          role="img"
          aria-label={`${centerLabel} by category`}
        >
          <g transform={`translate(${radius}, ${radius})`}>
            {arcs.map((a) => {
              const d = a.data;
              const isHot = active === d.label;
              // The zoom: the hovered slice is re-generated at a larger outer
              // radius rather than scaled, so its thickness and the gaps
              // between neighbours stay exactly right.
              const path =
                d3arc<typeof a>()
                  .innerRadius(inner)
                  .outerRadius(isHot ? outer + HOVER_GROW : outer)
                  .cornerRadius(1)(a) ?? undefined;
              return (
                <g
                  key={d.label}
                  className={styles.sliceHit}
                  onPointerEnter={() => setActive(d.label)}
                  onPointerMove={(e) => {
                    const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                    if (box) setPointer({ x: e.clientX - box.left, y: e.clientY - box.top });
                  }}
                  onPointerLeave={() => setActive(null)}
                >
                  <path
                    d={path}
                    fill={d.color}
                    stroke={surface}
                    strokeWidth={1}
                    className={`${styles.slice} ${isHot ? styles.sliceHot : ''} ${
                      active && !isHot ? styles.sliceDim : ''
                    }`}
                  />
                </g>
              );
            })}

            <text className={styles.centerValue} textAnchor="middle" dy="-0.1em">
              {formatCompactINR(centerValue)}
            </text>
            <text className={styles.centerLabel} textAnchor="middle" dy="1.5em">
              {centerText}
            </text>
          </g>
        </svg>

        {activeDatum && (
          <TooltipLayer left={pointer.x} top={pointer.y} containerWidth={size}>
            <ChartTooltip
              title={activeDatum.label}
              rows={[
                { label: 'Amount', value: `₹${formatAmount(activeDatum.value)}`, color: activeDatum.color },
                {
                  label: 'Share',
                  value: `${((activeDatum.value / (total || 1)) * 100).toFixed(1)}%`,
                  color: activeDatum.color,
                  muted: true,
                },
              ]}
            />
          </TooltipLayer>
        )}
      </div>

      {/* The legend doubles as the table view: every slice's share and value is
          readable without hovering anything. */}
      <div className={styles.legendWrap}>
        <ChartLegend
          entries={withColor.map((d) => ({
            label: d.label,
            color: d.color,
            shape: 'rect' as const,
            meta: `${((d.value / (grandTotal || 1)) * 100).toFixed(0)}% · ₹${formatAmount(d.value)}`,
          }))}
          hidden={hidden}
          onToggle={toggle}
          highlighted={active}
        />
      </div>
    </div>
  );
}
