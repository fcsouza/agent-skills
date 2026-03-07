import type { Transition, Variants } from 'framer-motion';

// ---------------------------------------------------------------------------
// Fade
// ---------------------------------------------------------------------------

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// ---------------------------------------------------------------------------
// Slide (factory)
// ---------------------------------------------------------------------------

export function slideVariants(
  direction: 'left' | 'right' | 'top' | 'bottom' = 'left',
  distance = 40,
): Variants {
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const sign = direction === 'left' || direction === 'top' ? -1 : 1;

  return {
    hidden: { opacity: 0, [axis]: sign * distance },
    visible: { opacity: 1, [axis]: 0 },
  };
}

// ---------------------------------------------------------------------------
// Scale
// ---------------------------------------------------------------------------

export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1 },
};

// ---------------------------------------------------------------------------
// Spring Transitions
// ---------------------------------------------------------------------------

export const springBounce: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 10,
};

export const springSmooth: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 30,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 25,
};

// ---------------------------------------------------------------------------
// Stagger Container (factory)
// ---------------------------------------------------------------------------

export function staggerContainer(
  staggerChildren = 0.08,
  delayChildren = 0,
): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren, delayChildren },
    },
  };
}

// ---------------------------------------------------------------------------
// Page Transition
// ---------------------------------------------------------------------------

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
};

// ---------------------------------------------------------------------------
// whileInView — scroll-triggered reveal (use directly as props, not variants)
// ---------------------------------------------------------------------------
//
// Usage:
//   <motion.div
//     initial="hidden"
//     whileInView="visible"
//     viewport={{ once: true, margin: '-100px' }}
//     variants={fadeVariants}
//     transition={{ duration: 0.5 }}
//   />
//
// viewport.once: true  → only animates once; doesn't replay on scroll back
// viewport.margin      → triggers N pixels before element enters viewport

// ---------------------------------------------------------------------------
// GSAP — copy snippets into components as needed (not importable)
// ---------------------------------------------------------------------------

// Timeline sequence (entrance → action → exit):
//
// import gsap from 'gsap';
// const tl = gsap.timeline();
// tl.from('.element', { opacity: 0, y: 40, duration: 0.5 })
//   .to('.element', { scale: 1.1, duration: 0.3 })
//   .to('.element', { opacity: 0, y: -40, duration: 0.4 });

// ScrollTrigger:
//
// import gsap from 'gsap';
// import { ScrollTrigger } from 'gsap/ScrollTrigger';
// gsap.registerPlugin(ScrollTrigger);
// gsap.from('.section', {
//   scrollTrigger: { trigger: '.section', start: 'top 80%', toggleActions: 'play none none reverse' },
//   opacity: 0, y: 60, duration: 0.8,
// });

// SVG path draw:
//
// import gsap from 'gsap';
// import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
// gsap.registerPlugin(DrawSVGPlugin);
// gsap.fromTo('.svg-path', { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.5, ease: 'power2.inOut' });
