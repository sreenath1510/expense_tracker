import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './TooltipLayer.module.scss';

interface TooltipLayerProps {
  /** Pointer position in container coordinates. */
  left: number;
  top: number;
  /** Width of the container, so the tip can be kept inside it. */
  containerWidth: number;
  children: ReactNode;
}

const EDGE = 4; // keep this much surface between the tip and the container edge
const OFFSET = 12; // clearance above the pointer

/**
 * Positions a tooltip above the pointer and keeps it inside the chart card —
 * the job @visx/tooltip's TooltipWithBounds does, minus the dependency. The
 * tip is measured after paint so a long category name can't push it off-screen.
 */
export function TooltipLayer({ left, top, containerWidth, children }: TooltipLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize((prev) =>
      Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
        ? prev
        : { w: r.width, h: r.height },
    );
  });

  const half = size.w / 2;
  const x = Math.min(Math.max(left, half + EDGE), Math.max(half + EDGE, containerWidth - half - EDGE));
  // Flip below the pointer when there isn't room above it.
  const above = top - OFFSET - size.h >= 0;
  const y = above ? top - OFFSET - size.h : top + OFFSET;

  return (
    <div ref={ref} className={styles.layer} style={{ left: x, top: y }} role="tooltip">
      {children}
    </div>
  );
}
