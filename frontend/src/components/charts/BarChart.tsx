import { formatCompactINR } from '@/utils/format';
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
}

const W = 720;
const H = 260;
const PAD = { l: 52, r: 16, t: 16, b: 28 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

/** Grouped vertical bars — used to compare income/expenditure across years. */
export function BarChart({ groups, series }: BarChartProps) {
  const all = groups.flatMap((g) => g.values);
  if (all.length === 0) return <p className={styles.empty}>No data to chart yet.</p>;

  const max = Math.max(...all, 1);
  const y = (v: number) => PAD.t + plotH * (1 - v / max);

  const bandW = plotW / groups.length;
  const barGap = 6;
  const innerW = Math.min(bandW * 0.7, 120);
  const barW = (innerW - barGap * (series.length - 1)) / series.length;

  const ticks = Array.from({ length: 4 }, (_, i) => (max * i) / 3);

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
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD.l - 8} y={y(t) + 3} className={styles.yLabel} textAnchor="end">
              {formatCompactINR(t)}
            </text>
          </g>
        ))}

        {groups.map((g, gi) => {
          const bandStart = PAD.l + gi * bandW + (bandW - innerW) / 2;
          return (
            <g key={g.label}>
              {g.values.map((v, si) => {
                const bx = bandStart + si * (barW + barGap);
                const by = y(v);
                return (
                  <rect
                    key={si}
                    x={bx}
                    y={by}
                    width={barW}
                    height={Math.max(0, PAD.t + plotH - by)}
                    rx={3}
                    fill={series[si].color}
                  />
                );
              })}
              <text x={PAD.l + gi * bandW + bandW / 2} y={H - 8} className={styles.xLabel} textAnchor="middle">
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
