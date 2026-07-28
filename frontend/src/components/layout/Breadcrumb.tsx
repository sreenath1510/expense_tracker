import { Link } from 'react-router-dom';
import styles from './Breadcrumb.module.scss';

export interface Crumb {
  label: string;
  /** Where this level lives. Omit on the current page — it isn't a link. */
  to?: string;
}

/**
 * The drilldown trail: Overview › FY 2025 › Feb 2026. Sits above the page
 * header and states where you are in the period hierarchy, which the month and
 * year titles alone can't (a month's parent depends on calendar vs fiscal mode).
 * The last crumb is always the current page, never a link.
 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className={styles.nav} aria-label="Breadcrumb">
      <ol className={styles.list}>
        {items.map((crumb, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className={styles.item}>
              {crumb.to && !isLast ? (
                <Link className={styles.link} to={crumb.to}>
                  {crumb.label}
                </Link>
              ) : (
                <span className={styles.current} aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <span className={styles.separator} aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
