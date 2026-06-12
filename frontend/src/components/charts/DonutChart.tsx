import { formatCompactINR } from '@/utils/format';
import { colorAt } from './palette';
import styles from './DonutChart.module.scss';

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  centerLabel?: string;
}

const SIZE = 180;
const STROKE = 26;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** A donut with a centered total and a legend — for category breakdowns. */
export function DonutChart({ data, centerLabel = 'Total' }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return <p className={styles.empty}>No data to chart yet.</p>;
  }

  let offset = 0;
  const segments = data.map((d, i) => {
    const len = (d.value / total) * C;
    const seg = {
      color: d.color ?? colorAt(i),
      dash: len,
      offset: -offset,
      pct: (d.value / total) * 100,
      ...d,
    };
    offset += len;
    return seg;
  });

  return (
    <div className={styles.wrap}>
      <svg className={styles.svg} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </g>
        <text x="50%" y="46%" className={styles.centerValue} textAnchor="middle">
          {formatCompactINR(total)}
        </text>
        <text x="50%" y="58%" className={styles.centerLabel} textAnchor="middle">
          {centerLabel}
        </text>
      </svg>

      <ul className={styles.legend}>
        {segments.map((s) => (
          <li key={s.label} className={styles.legendItem}>
            <span className={styles.dot} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendPct}>{s.pct.toFixed(0)}%</span>
            <span className={styles.legendValue}>{formatCompactINR(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
