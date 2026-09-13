/**
 * Shared Motion Variants & Helpers for Unutma AI
 * Designed for mobile-first 60fps performance and WCAG prefers-reduced-motion compliance.
 * Uses GPU-accelerated properties only: opacity, transform (translate, scale).
 */
import { Variants, Transition } from 'motion/react';

// Default spring/ease transition configs
export const gentleTransition: Transition = {
  duration: 0.24,
  ease: [0.25, 1, 0.5, 1],
};

export const quickTransition: Transition = {
  duration: 0.18,
  ease: [0.25, 1, 0.5, 1],
};

// Screen level transition
export const screenVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: gentleTransition,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: 'easeInOut' },
  },
};

// Modal backdrop & container variants
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: gentleTransition,
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// Home cards container & item stagger
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerCardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: gentleTransition,
  },
};

// Reminder list card item transition (for mounting, unmounting, active->complete)
export const reminderCardItemVariants: Variants = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// Micro-interaction presets for interactive buttons & cards
export const tapScale = {
  whileTap: { scale: 0.98 },
  whileHover: { scale: 1.01 },
  transition: { duration: 0.1 },
};

export const primaryButtonTap = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.02 },
  transition: { duration: 0.1 },
};

export const subtleTap = {
  whileTap: { scale: 0.98 },
  transition: { duration: 0.08 },
};

export const iconTap = {
  whileTap: { scale: 0.98 },
  whileHover: { scale: 1.02 },
  transition: { duration: 0.1 },
};
