---
name: react-animations
description: >-
  Use when implementing animations, transitions, or motion in React apps. Triggers: animation, transition, motion, animate, framer motion, react spring, GSAP, keyframe, entrance, exit, layout animation, gesture, drag, scroll animation, parallax.
---

# React Animations

## Purpose

Production-quality animations in React using Framer Motion (primary), React Spring (physics), GSAP (timelines), and CSS/Tailwind (simple cases). Covers entrance/exit, layout, gesture-driven, scroll-triggered, and game UI animations.

## When to Use

Trigger: animation, transition, motion, animate, framer motion, react spring, GSAP, keyframe, entrance animation, exit animation, layout animation, gesture, drag, scroll animation, parallax, game UI effects, card flip, screen shake, health bar, damage numbers

## Library Decision Table

| Use Case | Library | Why |
|---|---|---|
| Entrance/exit animations | Framer Motion | AnimatePresence handles unmount |
| Shared element transitions | Framer Motion | layoutId |
| Physics-based (spring, bounce) | Framer Motion or React Spring | spring config |
| Complex timelines / sequences | GSAP | Timeline API |
| Scroll-triggered | Framer Motion (useScroll) or GSAP ScrollTrigger | Built-in scroll hooks |
| Simple hover/focus states | CSS Tailwind | No JS needed |
| Drag and drop | Framer Motion | Built-in gesture support |
| SVG path animations | GSAP or Framer Motion | Both support SVG |

## Core Principles

> Matt Perry (Framer Motion creator): "Animations should be declared, not imperatively managed. Describe the target state — the library handles the rest."
> Sarah Drasner: "Animation is not decoration — it's communication. Every motion should serve a purpose."
> Lea Verou: "Use CSS transitions for what CSS can handle. Reach for JavaScript only when CSS falls short."
> Tom Occhino: "Performance isn't an afterthought — it's a feature. 60fps or nothing."

1. **CSS for simple, JS for complex** — if Tailwind `transition` works, use it; don't add Framer Motion for hover states
2. **Only animate composited properties** — `transform` and `opacity`; never `width`, `height`, `top`, `left` (causes reflow)
3. **AnimatePresence wraps conditional renders** — without it, exit animations are skipped
4. **Variants for coordinated animations** — define animation states as objects, not inline values
5. **layoutId for shared element transitions** — React handles the interpolation between positions
6. **useMotionValue for gesture-driven** — don't use useState for values that drive animations
7. **60fps budget** — keep animation logic out of render cycle; use transforms

## Key Framer Motion Patterns

### Basic Animate

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
/>
```

### Variants with Children Stagger

```tsx
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((i) => (
    <motion.li key={i} variants={item} />
  ))}
</motion.ul>
```

### AnimatePresence with Exit

```tsx
<AnimatePresence>
  {isVisible && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    />
  )}
</AnimatePresence>
```

### layoutId Shared Element

```tsx
// In list view
<motion.div layoutId={`card-${id}`}>
  <Thumbnail />
</motion.div>

// In detail view
<motion.div layoutId={`card-${id}`}>
  <FullImage />
</motion.div>
```

### useScroll + useTransform for Parallax

```tsx
const { scrollYProgress } = useScroll();
const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

<motion.div style={{ y }} />
```

### Drag with Constraints

```tsx
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
  dragElastic={0.2}
  whileDrag={{ scale: 1.1 }}
/>
```

## Game UI Patterns

### Health Bar Smooth Tweening

```tsx
const motionWidth = useMotionValue(current / max);
const springWidth = useSpring(motionWidth, { stiffness: 200, damping: 30 });

<motion.div style={{ scaleX: springWidth, transformOrigin: 'left' }} />
```

### Damage Numbers Floating Up

```tsx
<motion.span
  initial={{ opacity: 1, y: 0 }}
  animate={{ opacity: 0, y: -60 }}
  transition={{ duration: 0.8, ease: 'easeOut' }}
  onAnimationComplete={onComplete}
>
  -{damage}
</motion.span>
```

### Card Flip (rotateY)

```tsx
<motion.div animate={{ rotateY: isFlipped ? 180 : 0 }} style={{ perspective: 1000 }}>
  <div style={{ backfaceVisibility: 'hidden' }}>{front}</div>
  <div style={{ backfaceVisibility: 'hidden', rotateY: 180 }}>{back}</div>
</motion.div>
```

### Screen Shake

```tsx
const x = useMotionValue(0);
const controls = useAnimation();

const shake = () => controls.start({
  x: [0, -10, 10, -10, 10, 0],
  transition: { duration: 0.4 },
});
```

### Menu Slide-In / Slide-Out

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.nav
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    />
  )}
</AnimatePresence>
```

### Inventory Item Drop (Spring Physics)

```tsx
<motion.div
  initial={{ y: -200, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
/>
```

## Performance

- Use `transform` and `opacity` only — these are GPU-composited and don't trigger layout/paint
- `will-change: transform` for elements that always animate — hints to the browser to promote to own layer
- Don't wrap expensive React components in `motion.div` — use `motion.create(Component)` to avoid re-renders
- `layout` prop triggers automatic layout animations — expensive on large DOM trees; use sparingly
- Prefer `useMotionValue` over `useState` for animation-driving values — motion values don't trigger re-renders
- Batch animation updates — avoid triggering multiple independent animations on the same frame
- Use `useReducedMotion` hook to respect user accessibility preferences

## Step-by-Step Instructions

### 1. Install Framer Motion

```bash
bun add framer-motion
```

### 2. No Setup Needed

Framer Motion is zero-config. No providers, no context, no wrappers required.

### 3. Replace `div` with `motion.div`

Only where animation is needed. Don't wrap everything in motion components.

### 4. Define Variants Outside Components

```tsx
// Stable reference — no re-creation on render
const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
```

### 5. Wrap Conditional Renders with AnimatePresence

```tsx
<AnimatePresence>
  {show && <motion.div key="item" exit={{ opacity: 0 }} />}
</AnimatePresence>
```

### 6. Use layoutId for Shared Elements

Add matching `layoutId` props on elements that represent the same item across different views. Framer Motion automatically interpolates between positions.

## Cross-References

- `vercel-react-best-practices` — React performance patterns
- `ui-ux-game` — game HUD and UI patterns
- `frontend-design` — component design and Tailwind patterns

## Pitfalls & Anti-Patterns

- **Animating layout-triggering properties** (`width`, `height`, `top`, `left`) — use `scaleX`/`scaleY` or the `layout` prop instead
- **Forgetting AnimatePresence** when using `exit` prop — exit animations silently skip without the wrapper
- **Creating motion values in render** — use `useMotionValue` hook; creating in render causes memory leaks and broken animations
- **Using CSS `transition` AND Framer Motion on same element** — they conflict; pick one
- **Over-animating** — every interaction animated is sensory overload; animate to communicate, not to decorate
- **Animating on mount without `initial`** — component flashes in default state before animating; always set `initial`
- **Large `layout` animations** — `layout` prop on deeply nested trees causes expensive recalculations; scope to smallest possible subtree

## Sources

- Framer Motion documentation — https://motion.dev
- Matt Perry — Framer Motion creator, API design talks
- Sarah Drasner — "SVG Animations", animation design patterns
- GSAP documentation — https://gsap.com
- Web Animations API specification — W3C
- "Animation at Work" — Rachel Nabors
