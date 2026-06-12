import { forwardRef } from 'react';
import type { SelectHTMLAttributes, ReactNode } from 'react';
import styles from './Select.module.scss';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
  /** Compact variant for dense contexts like the mapping table. */
  compact?: boolean;
}

/** Native select styled to match Input. Native keeps it accessible and fast. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className, compact, children, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <div className={styles.field}>
        {label && (
          <label htmlFor={selectId} className={styles.label}>
            {label}
          </label>
        )}
        <div className={styles.wrap}>
          <select
            ref={ref}
            id={selectId}
            className={`${styles.select} ${compact ? styles.compact : ''} ${
              error ? styles.hasError : ''
            } ${className ?? ''}`}
            {...rest}
          >
            {children}
          </select>
          <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  },
);

Select.displayName = 'Select';
