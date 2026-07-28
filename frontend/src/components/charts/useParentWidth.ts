import { useEffect, useRef, useState } from 'react';

/**
 * Measure a container so the SVG can size itself to it. Stands in for
 * @visx/responsive's ParentSize, which is a render-prop wrapper around the
 * same ResizeObserver.
 */
export function useParentWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      // Round to whole pixels: sub-pixel jitter would re-render on every frame
      // of a resize for no visible gain.
      setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : Math.round(w)));
    });
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
