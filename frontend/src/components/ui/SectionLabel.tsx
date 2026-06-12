import styles from './SectionLabel.module.scss';

interface SectionLabelProps {
  children: string;
  /** Gently pulses the dot (theme.md "live" indicator). */
  pulse?: boolean;
}

/** The signature pill badge that prefixes sections (theme.md > Section Labels). */
export function SectionLabel({ children, pulse = false }: SectionLabelProps) {
  return (
    <span className={styles.label}>
      <span className={`${styles.dot} ${pulse ? styles.pulse : ''}`} />
      <span className={styles.text}>{children}</span>
    </span>
  );
}
