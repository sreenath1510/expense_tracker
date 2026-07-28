import type { ReactNode } from 'react';
import styles from './ChartTooltip.module.scss';

export interface TooltipRow {
  label: string;
  value: string;
  color: string;
  /** Render the key as a short stroke (lines) rather than a swatch (bars/areas). */
  line?: boolean;
  /** De-emphasise, e.g. a derived total under the series rows. */
  muted?: boolean;
}

interface ChartTooltipProps {
  title: ReactNode;
  rows: TooltipRow[];
}

/**
 * The readout body shared by every chart. Two rules from the house style:
 * the value leads and the label follows — the reader already knows which
 * series they're pointing at and wants the number — and the series key is a
 * short line, not a filled box, because at this density a box is data-weight
 * ink doing a label's job.
 *
 * Labels come from user-entered category names, so they go in as text nodes
 * (JSX children), never as markup.
 */
export function ChartTooltip({ title, rows }: ChartTooltipProps) {
  return (
    <div className={styles.tip}>
      <div className={styles.title}>{title}</div>
      <ul className={styles.rows}>
        {rows.map((r) => (
          <li key={r.label} className={`${styles.row} ${r.muted ? styles.rowMuted : ''}`}>
            <span
              className={r.line ? styles.keyLine : styles.keySwatch}
              style={{ background: r.color }}
              aria-hidden="true"
            />
            <span className={styles.label}>{r.label}</span>
            <span className={styles.value}>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
