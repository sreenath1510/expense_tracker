import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setPeriodMode } from '@/features/ui/uiSlice';
import type { PeriodMode } from '@/utils/period';
import styles from './PeriodModeToggle.module.scss';

const OPTIONS: { value: PeriodMode; label: string; title: string }[] = [
  { value: 'fiscal', label: 'FY', title: 'Financial year — Apr to Mar' },
  { value: 'calendar', label: 'Cal', title: 'Calendar year — Jan to Dec' },
];

/** Compact segmented control switching the global calendar/fiscal windowing. */
export function PeriodModeToggle() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.periodMode);

  return (
    <div className={styles.group} role="group" aria-label="Year mode">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          aria-pressed={mode === opt.value}
          className={`${styles.btn} ${mode === opt.value ? styles.active : ''}`}
          onClick={() => dispatch(setPeriodMode(opt.value))}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
