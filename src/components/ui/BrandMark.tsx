import React, { useId } from 'react';
import { motion } from 'motion/react';

interface BrandMarkProps {
  size?: number;
  /** Draw the thread on mount (splash) instead of showing it finished */
  animate?: boolean;
  delay?: number;
  className?: string;
}

/**
 * Unutma's mark: a gold thread tied in a loop — the string you tie around a
 * finger so you don't forget — with a pomegranate seed held inside it.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 64, animate = false, delay = 0, className }) => {
  const id = useId().replace(/:/g, '');
  const thread = 'M5 47 C17 47.5 27 43 31.5 33 C36 22.5 32 11.5 25.5 13 C18.5 14.5 19 30 31 39.5 C39 45.5 49 46 59 40';

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="18" y1="10" x2="46" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbedc9" />
          <stop offset="0.45" stopColor="#ecb74a" />
          <stop offset="1" stopColor="#c78626" />
        </linearGradient>
        <radialGradient id={`s${id}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(25.4 20.6) rotate(50) scale(4.8)">
          <stop stopColor="#f7bac5" />
          <stop offset="1" stopColor="#c3304b" />
        </radialGradient>
      </defs>
      <motion.path
        d={thread}
        stroke={`url(#g${id})`}
        strokeWidth={4.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 1.1, delay, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.2, delay } }}
      />
      <motion.ellipse
        cx="26.6"
        cy="22.5"
        rx="3.3"
        ry="4.3"
        fill={`url(#s${id})`}
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 14, delay: delay + 0.95 }}
        style={{ transformOrigin: '26.6px 22.5px' }}
      />
    </svg>
  );
};
