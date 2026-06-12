import type { ReactNode } from 'react';
import styles from './PageHeader.module.scss';

interface PageHeaderProps {
  label: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}

/**
 * Compact page header: a small eyebrow label + title on the left, actions on
 * the right, separated by a hairline. Kept deliberately low-profile so the
 * data (tables, numbers) is the focus rather than the chrome.
 */
export function PageHeader({ label, title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <span className={styles.eyebrow}>{label}</span>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
