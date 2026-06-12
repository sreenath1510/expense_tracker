import { useId } from 'react';
import { formatCompactINR } from '@/utils/format';
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
}

const W = 720;
const H = 260;
const PAD = { l: 52, r: 16, t: 16, b: 28 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/** Multi-series line/area chart for monthly trends. Scales to its container. */
export function TrendChart({ labels, series }: TrendChartProps) {
  const gradId = useId().replace(/:/g, '');
  const all = series.flatMap((s) => s.values);
  if (all.length === 0) return <p className={styles.empty}>No data to chart yet.</p>;

  const rawMax = Math.max(...all, 0);
  const rawMin = Math.min(...all, 0);
  const max = rawMax === rawMin ? rawMax + 1 : rawMax;
  const min = rawMin;
  const range = max - min || 1;

  const n = labels.length;
  const x = (i: number) => (n <= 1 ? PAD.l + plotW / 2 : PAD.l + (i * plotW) / (n - 1));
  const y = (v: number) => PAD.t + plotH * (1 - (v - min) / range);

  // 4 horizontal gridlines with value labels.
  const ticks = Array.from({ length: 4 }, (_, i) => min + (range * i) / 3);

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        {series.map((s) => (
          <span key={s.label} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`${gradId}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 8} y={y(t) + 3} className={styles.yLabel} textAnchor="end">
              {formatCompactINR(t)}
            </text>
          </g>
        ))}

        {/* zero baseline if range crosses zero */}
        {min < 0 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className={styles.zero} />
        )}

        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          const areaPts = `${PAD.l},${y(min)} ${pts} ${x(s.values.length - 1)},${y(min)}`;
          return (
            <g key={s.label}>
              {s.area && <polygon points={areaPts} fill={`url(#${gradId}-${si})`} />}
              <polyline
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={s.color} />
              ))}
            </g>
          );
        })}

        {/* x labels */}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} className={styles.xLabel} textAnchor="middle">
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}
