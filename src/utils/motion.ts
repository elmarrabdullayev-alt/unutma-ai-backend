/**
 * Unutma AI motion system.
 *
 * One vocabulary for the whole app:
 * - springs for anything the finger touches (press, toggle, sheet),
 * - a single expo-out curve for things that appear on their own,
 * - only transform + opacity (GPU friendly), and every preset is
 *   neutralised by the global prefers-reduced-motion rule in index.css
 *   plus <MotionConfig reducedMotion="user"> in App.
 */
import { Variants, Transition } from 'motion/react';

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Snappy, slightly elastic — buttons, checkboxes, chips */
export const springPress: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.7 };
/** Calm, no overshoot — cards and list items moving into place */
export const springLayout: Transition = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 };
/** Bottom sheets and full-screen panels */
export const springSheet: Transition = { type: 'spring', stiffness: 300, damping: 34, mass: 1 };

export const gentleTransition: Transition = { duration: 0.38, ease: EASE_OUT_EXPO };
export const quickTransition: Transition = { duration: 0.22, ease: EASE_OUT_EXPO };

// Screen level transition (tab switch)
export const screenVariants: Variants = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: -6, filter: 'blur(2px)', transition: { duration: 0.18, ease: 'easeIn' } },
};

// Modal backdrop & container
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springSheet },
  exit: { opacity: 0, y: 30, scale: 0.98, transition: { duration: 0.2, ease: 'easeIn' } },
};

/** Bottom sheet that rises from the bottom edge */
export const sheetVariants: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: springSheet },
  exit: { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } },
};

// Page-load choreography: one orchestrated entrance, short stagger
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerCardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
};

// Reminder rows: enter softly, leave by folding away
export const reminderCardItemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: springLayout },
  exit: {
    opacity: 0,
    x: 24,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    transition: { opacity: { duration: 0.18 }, x: { duration: 0.25 }, height: { delay: 0.12, duration: 0.28, ease: EASE_OUT_EXPO } },
  },
};

// Micro-interaction presets for interactive buttons & cards
export const tapScale = { whileTap: { scale: 0.98 }, transition: springPress };
export const primaryButtonTap = { whileTap: { scale: 0.96 }, transition: springPress };
export const subtleTap = { whileTap: { scale: 0.985 }, transition: springPress };
export const iconTap = { whileTap: { scale: 0.88 }, transition: springPress };
