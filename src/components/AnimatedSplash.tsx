import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandMark } from './ui/BrandMark';

interface AnimatedSplashProps {
  onComplete: () => void;
}

/**
 * One orchestrated moment: the thread ties itself, the seed drops in,
 * the name settles underneath. Then the curtain lifts.
 */
export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onComplete }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const total = reduce ? 600 : 2300;
    const t1 = setTimeout(() => setLeaving(true), Math.max(250, total - 420));
    const t2 = setTimeout(onComplete, total);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          key="splash"
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[9999] flex h-[100dvh] w-full select-none flex-col items-center justify-center overflow-hidden"
          style={{
            background:
              'radial-gradient(70% 45% at 50% 42%, rgb(226 163 50 / 0.16), transparent 70%), radial-gradient(60% 40% at 50% 100%, rgb(225 71 98 / 0.08), transparent 70%), var(--color-ink-950)',
          }}
        >
          <motion.div
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 -m-8 rounded-full"
              style={{ background: 'radial-gradient(circle, rgb(236 183 74 / 0.28), transparent 65%)' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0.6], scale: [0.6, 1.15, 1] }}
              transition={{ duration: 1.6, delay: 0.9, ease: 'easeOut' }}
            />
            <BrandMark size={112} animate delay={0.15} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14, letterSpacing: '0.04em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '-0.01em' }}
            transition={{ duration: 0.9, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="font-display mt-6 text-[40px] leading-none text-ink-50"
          >
            Unutma
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="mt-3 text-[14px] text-ink-300"
          >
            Sənin yerinə yadda saxlayır
          </motion.p>

          <motion.span
            id="splash-founder-signature"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="font-display absolute text-[15px] text-zer-200"
            style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 32px)' }}
          >
            by Elmar
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
