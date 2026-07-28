import { useCallback, useState } from 'react';
import styles from './ChartLegend.module.scss';

export interface LegendEntry {
  label: string;
  color: string;
  /** Mirror the mark: a stroke for lines, a swatch for bars and areas. */
  shape?: 'line' | 'rect';
  /** Optional trailing figure, e.g. the donut's share of total. */
  meta?: string;
}

interface ChartLegendProps {
  entries: LegendEntry[];
  hidden: ReadonlySet<string>;
  onToggle: (label: string) => void;
  /** Emphasise one entry (the hovered mark), dimming the rest. */
  highlighted?: string | null;
  align?: 'start' | 'end';
}

/**
 * Clickable legend. A legend is always present for two or more series — it's
 * the identity channel that doesn't depend on the reader matching colors — and
 * here it doubles as the filter: click an entry to drop that series from the
 * plot, click again to bring it back.
 *
 * Toggling never repaints the survivors. Color follows the entity, so a reader
 * who learned "Investments is purple" keeps that after filtering.
 */
export function ChartLegend({
  entries,
  hidden,
  onToggle,
  highlighted = null,
  align = 'start',
}: ChartLegendProps) {
  return (
    <ul className={`${styles.legend} ${align === 'end' ? styles.alignEnd : ''}`}>
      {entries.map((e) => {
        const off = hidden.has(e.label);
        const dimmed = highlighted !== null && highlighted !== e.label;
        return (
          <li key={e.label}>
            <button
              type="button"
              aria-pressed={!off}
              title={off ? `Show ${e.label}` : `Hide ${e.label}`}
              className={`${styles.item} ${off ? styles.off : ''} ${
                dimmed ? styles.dimmed : ''
              }`}
              onClick={() => onToggle(e.label)}
            >
              <span
                className={e.shape === 'line' ? styles.keyLine : styles.keyRect}
                style={{ background: e.color }}
                aria-hidden="true"
              />
              <span className={styles.label}>{e.label}</span>
              {e.meta && <span className={styles.meta}>{e.meta}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Which series are switched off. Kept here so every chart toggles the same way,
 * and keyed by label so the set survives a data refetch that reorders series.
 */
export function useHiddenSeries() {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((label: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }, []);

  return { hidden, toggle };
}
