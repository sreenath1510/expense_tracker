import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.scss';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a hover lift + gradient overlay (theme.md > Cards hover effects). */
  interactive?: boolean;
  /** Pads the card body. Defaults to true. */
  padded?: boolean;
  children: ReactNode;
}

/** Card — theme.md > Cards. White surface, 1px border, soft shadow. */
export function Card({
  interactive = false,
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    styles.card,
    interactive && styles.interactive,
    padded && styles.padded,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
