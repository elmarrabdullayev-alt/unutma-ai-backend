import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { springPress } from '../../utils/motion';

interface CompletionCheckProps {
  checked: boolean;
  onToggle: (e: React.MouseEvent) => void;
  label?: string;
  size?: 'md' | 'lg';
  tone?: 'default' | 'overdue';
}

const SEEDS = 7;

/**
 * The one moment of delight in the list: the ring fills with pistachio,
 * the tick draws itself, and a few pomegranate seeds burst outwards.
 */
export const CompletionCheck: React.FC<CompletionCheckProps> = ({
  checked,
  onToggle,
  label,
  size = 'md',
  tone = 'default',
}) => {
  const [burstKey, setBurstKey] = useState(0);
  const dim = size === 'lg' ? 30 : 26;

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label || (checked ? 'Aktiv et' : 'Tamamla')}
      onClick={(e) => {
        if (!checked) setBurstKey((k) => k + 1);
        onToggle(e);
      }}
      whileTap={{ scale: 0.82 }}
      transition={springPress}
      className="relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full"
    >
      <motion.span
        initial={false}
        animate={{
          backgroundColor: checked ? 'var(--color-pista-400)' : 'rgba(255,240,225,0)',
          borderColor: checked
            ? 'var(--color-pista-400)'
            : tone === 'overdue'
            ? 'rgba(236,106,129,0.75)'
            : 'rgba(255,236,220,0.28)',
          scale: checked ? [1, 1.18, 1] : 1,
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-center rounded-full border-[1.75px]"
        style={{ width: dim, height: dim }}
      >
        <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" fill="none" aria-hidden="true">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            stroke="var(--color-ink-950)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: checked ? 0.32 : 0.12, delay: checked ? 0.08 : 0, ease: 'easeOut' }}
          />
        </svg>
      </motion.span>

      <AnimatePresence>
        {burstKey > 0 && checked && (
          <span key={burstKey} className="pointer-events-none absolute inset-0" aria-hidden="true">
            {Array.from({ length: SEEDS }).map((_, i) => {
              const angle = (i / SEEDS) * Math.PI * 2 - Math.PI / 2;
              const dist = 20 + (i % 2) * 6;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-[5px] w-[5px] rounded-full"
                  style={{
                    marginLeft: -2.5,
                    marginTop: -2.5,
                    background: i % 3 === 0 ? 'var(--color-zer-300)' : 'var(--color-nar-400)',
                  }}
                  initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                  animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: [0.4, 1, 0], opacity: [1, 1, 0] }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}
          </span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
