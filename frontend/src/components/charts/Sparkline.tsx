interface SparklineProps {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}

/** Tiny inline trend line (no axes) for cards. */
export function Sparkline({ values, color = '#0052ff', width = 120, height = 32 }: SparklineProps) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const n = values.length;
  const x = (i: number) => (n <= 1 ? width / 2 : (i * width) / (n - 1));
  const y = (v: number) => height - 2 - (height - 4) * ((v - min) / range);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
