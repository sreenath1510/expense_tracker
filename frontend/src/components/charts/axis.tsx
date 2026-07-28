import type { ScaleBand, ScaleLinear } from 'd3-scale';

// =============================================================================
// AXIS & GRID  —  hand-rolled on purpose
// =============================================================================
// @visx/axis and @visx/grid would render these, but they drag in @visx/text's
// string-measuring machinery and @visx/scale's full re-export (time scales,
// locale formatters) for what amounts to a list of <line> and <text> elements.
// Dropping them cut the charts chunk by roughly a third. The scales themselves
// come straight from d3-scale, which is what visx wraps anyway.

interface GridRowsProps {
  scale: ScaleLinear<number, number>;
  width: number;
  ticks: number[];
  className?: string;
}

/** Horizontal gridlines: solid hairlines, one step off the surface. */
export function GridRows({ scale, width, ticks, className }: GridRowsProps) {
  return (
    <g className={className} aria-hidden="true">
      {ticks.map((t) => (
        <line key={t} x1={0} x2={width} y1={scale(t)} y2={scale(t)} />
      ))}
    </g>
  );
}

interface AxisLeftProps {
  scale: ScaleLinear<number, number>;
  ticks: number[];
  format: (value: number) => string;
  className?: string;
}

/** Value axis. No axis line, no tick marks — the gridlines already carry it. */
export function AxisLeft({ scale, ticks, format, className }: AxisLeftProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <text key={t} x={-8} y={scale(t)} dy={3} textAnchor="end" className={className}>
          {format(t)}
        </text>
      ))}
    </g>
  );
}

interface AxisBottomBandProps {
  scale: ScaleBand<string>;
  top: number;
  className?: string;
}

/** Category axis for banded (bar) scales. */
export function AxisBottomBand({ scale, top, className }: AxisBottomBandProps) {
  const half = scale.bandwidth() / 2;
  return (
    <g transform={`translate(0, ${top})`} aria-hidden="true">
      {scale.domain().map((d) => (
        <text key={d} x={(scale(d) ?? 0) + half} y={16} textAnchor="middle" className={className}>
          {d}
        </text>
      ))}
    </g>
  );
}

interface AxisBottomIndexProps {
  scale: ScaleLinear<number, number>;
  labels: string[];
  /** Render every nth label — thinning beats letting them collide. */
  step: number;
  top: number;
  className?: string;
}

/** Category axis for an index-based (line) scale. */
export function AxisBottomIndex({ scale, labels, step, top, className }: AxisBottomIndexProps) {
  return (
    <g transform={`translate(0, ${top})`} aria-hidden="true">
      {labels.map((label, i) =>
        i % step === 0 ? (
          <text key={i} x={scale(i)} y={16} textAnchor="middle" className={className}>
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}
