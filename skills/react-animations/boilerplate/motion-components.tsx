'use client';

import {
  type HTMLMotionProps,
  type Variants,
  AnimatePresence,
  motion,
  useAnimate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { type ReactNode, useEffect } from 'react';

// ---------------------------------------------------------------------------
// FadeIn
// ---------------------------------------------------------------------------

interface FadeInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  duration?: number;
  delay?: number;
}

export function FadeIn({
  children,
  duration = 0.3,
  delay = 0,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SlideIn
// ---------------------------------------------------------------------------

type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

interface SlideInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  from?: SlideDirection;
  distance?: number;
  duration?: number;
}

const slideOffsets: Record<SlideDirection, (d: number) => { x?: number; y?: number }> = {
  left: (d) => ({ x: -d }),
  right: (d) => ({ x: d }),
  top: (d) => ({ y: -d }),
  bottom: (d) => ({ y: d }),
};

export function SlideIn({
  children,
  from = 'left',
  distance = 40,
  duration = 0.4,
  className,
  ...props
}: SlideInProps) {
  const shouldReduceMotion = useReducedMotion();
  const offset = shouldReduceMotion ? {} : slideOffsets[from](distance);

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{ duration: shouldReduceMotion ? 0 : duration, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ScaleIn
// ---------------------------------------------------------------------------

interface ScaleInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  duration?: number;
  delay?: number;
}

export function ScaleIn({
  children,
  duration = 0.3,
  delay = 0,
  className,
  ...props
}: ScaleInProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20, delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// StaggerList
// ---------------------------------------------------------------------------

interface StaggerListProps extends HTMLMotionProps<'ul'> {
  items: ReactNode[];
  // Provide stable keys for your items — avoids reconciliation issues
  itemKeys?: (string | number)[];
  staggerDelay?: number;
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: (staggerDelay: number) => ({
    opacity: 1,
    transition: { staggerChildren: staggerDelay },
  }),
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function StaggerList({
  items,
  itemKeys,
  staggerDelay = 0.08,
  className,
  ...props
}: StaggerListProps) {
  return (
    <motion.ul
      variants={staggerContainer}
      custom={staggerDelay}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {items.map((child, i) => (
        <motion.li key={itemKeys?.[i] ?? i} variants={staggerItem}>
          {child}
        </motion.li>
      ))}
    </motion.ul>
  );
}

// ---------------------------------------------------------------------------
// FloatingNumber — game UI: damage, score, XP pop-up
// ---------------------------------------------------------------------------

interface FloatingNumberProps {
  value: string | number;
  color?: string;
  onComplete?: () => void;
}

export function FloatingNumber({
  value,
  color = '#ef4444',
  onComplete,
}: FloatingNumberProps) {
  return (
    <motion.span
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -60, scale: 1.3 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      style={{
        color,
        position: 'absolute',
        pointerEvents: 'none',
        fontWeight: 700,
        fontSize: '1.25rem',
      }}
    >
      {value}
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// HealthBar — smooth tweening health bar for game UI
// ---------------------------------------------------------------------------

interface HealthBarProps {
  current: number;
  max: number;
  color?: string;
  className?: string;
}

export function HealthBar({
  current,
  max,
  color = '#22c55e',
  className,
}: HealthBarProps) {
  const initialRatio = Math.max(0, Math.min(1, current / max));
  const ratio = useMotionValue(initialRatio);
  const spring = useSpring(ratio, { stiffness: 200, damping: 30 });
  const width = useTransform(spring, (v) => `${v * 100}%`);

  useEffect(() => {
    ratio.set(Math.max(0, Math.min(1, current / max)));
  }, [current, max, ratio]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          width,
          height: '100%',
          backgroundColor: color,
          borderRadius: 6,
          transformOrigin: 'left',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedCard — card flip animation (card games / skill reveals)
// ---------------------------------------------------------------------------

interface AnimatedCardProps {
  front: ReactNode;
  back: ReactNode;
  isFlipped: boolean;
  className?: string;
}

export function AnimatedCard({
  front,
  back,
  isFlipped,
  className,
}: AnimatedCardProps) {
  return (
    <div className={className} style={{ perspective: 1000 }}>
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{ position: 'relative', transformStyle: 'preserve-3d' }}
      >
        <div
          style={{
            backfaceVisibility: 'hidden',
            position: 'absolute',
            inset: 0,
          }}
        >
          {front}
        </div>
        <div
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScreenShake — wraps children; call shake() to trigger
// ---------------------------------------------------------------------------

interface ScreenShakeProps {
  children: ReactNode;
  className?: string;
  onShakeRef?: (shake: () => Promise<void>) => void;
}

export function ScreenShake({ children, className, onShakeRef }: ScreenShakeProps) {
  const [scope, animate] = useAnimate();

  const shake = async () => {
    await animate(scope.current, { x: [0, -10, 10, -10, 10, 0] }, { duration: 0.4 });
  };

  // Expose the shake function via ref callback so parent can trigger it
  useEffect(() => {
    onShakeRef?.(shake);
  }, []);

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
