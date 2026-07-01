import { useId } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Ledger mark: a gradient rounded-square holding a rising trend line with a
 * ₹ baseline — finance + growth in one glyph. Gradient ids are per-instance
 * so multiple logos on a page don't collide.
 */
export function Logo({ size = 40, className }: LogoProps) {
  const id = useId().replace(/:/g, '');
  const grad = `lg-${id}`;
  const glow = `lg-glow-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="img"
      aria-label="Fathom"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052ff" />
          <stop offset="1" stopColor="#4d7cff" />
        </linearGradient>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      <rect width="40" height="40" rx="11" fill={`url(#${grad})`} />

      {/* rising trend line */}
      <polyline
        points="9,27 16,20 22,24 31,12"
        stroke="#fff"
        strokeOpacity="0.95"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${glow})`}
      />
      <polyline
        points="9,27 16,20 22,24 31,12"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="31" cy="12" r="2.6" fill="#fff" />

      {/* baseline tick marks — ledger ruling */}
      <path
        d="M9 32h22"
        stroke="#fff"
        strokeOpacity="0.4"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
