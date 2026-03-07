---
name: react-animations
description: >-
  Use when implementing animations, transitions, or motion effects in React apps. Invoke this skill whenever someone asks about animation, transition, motion, framer motion, react spring, GSAP, entrance/exit effects, scroll animation, parallax, gesture, drag, card flip, screen shake, health bar, damage numbers, loading states, page transitions, hover effects, or any element that should move, fade, scale, or respond to interaction — even if they don't use the word "animation".
---

# React Animations

Production-quality animations in React using Framer Motion (primary), React Spring (physics), GSAP (timelines), and CSS/Tailwind (simple cases).

## Library Decision Table

| Use Case | Library | Why |
|---|---|---|
| Entrance/exit animations | Framer Motion | AnimatePresence handles unmount |
| Shared element transitions | Framer Motion | layoutId |
| Physics-based (spring, bounce) | Framer Motion or React Spring | spring config |
| Complex timelines / sequences | GSAP | Timeline API |
| Scroll-triggered | Framer Motion (whileInView / useScroll) | Built-in scroll hooks |
| Simple hover/focus states | CSS Tailwind | No JS needed |
| Drag and drop | Framer Motion | Built-in gesture support |
| SVG path animations | GSAP or Framer Motion | Both support SVG |
| Imperative / programmatic | Framer Motion useAnimate | Modern imperative API |

## Core Principles

> Matt Perry (Framer Motion creator): "Animations should be declared, not imperatively managed. Describe the target state — the library handles the rest."
> Sarah Drasner: "Animation is not decoration — it's communication. Every motion should serve a purpose."

1. **CSS for simple, JS for complex** — if Tailwind `transition` works, use it; don't add Framer Motion for hover states
2. **Only animate composited properties** — `transform` and `opacity`; never `width`, `height`, `top`, `left` (causes reflow)
3. **AnimatePresence wraps conditional renders** — without it, exit animations are skipped
4. **Variants for coordinated animations** — define animation states as objects outside the component, not inline values
5. **layoutId for shared element transitions** — Framer Motion handles the interpolation between positions
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

### Gesture States (whileHover, whileTap)

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
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

The `mode` prop controls how entering/exiting elements interact:
- `"sync"` (default) — enter and exit happen simultaneously
- `"wait"` — exit completes before enter starts (good for page transitions)
- `"popLayout"` — exiting element is removed from layout flow immediately

```tsx
<AnimatePresence mode="wait">
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

### whileInView for Scroll-Triggered Animations

The simplest approach — no scroll hooks needed:

```tsx
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-100px' }}
  transition={{ duration: 0.5 }}
/>
```

Use `viewport.once: true` so the animation doesn't replay on scroll back.

### useScroll + useTransform for Parallax

```tsx
const { scrollYProgress } = useScroll();
const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

<motion.div style={{ y }} />
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

### Drag with Constraints

```tsx
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
  dragElastic={0.2}
  whileDrag={{ scale: 1.1 }}
/>
```

### useAnimate — Imperative Animations (v11+)

Prefer `useAnimate` over `useAnimation` for programmatic sequences. It's scoped to a ref and works with any selector within that scope:

```tsx
const [scope, animate] = useAnimate();

const handleClick = async () => {
  await animate(scope.current, { scale: 1.2 }, { duration: 0.2 });
  await animate(scope.current, { scale: 1 }, { duration: 0.1 });
};

<div ref={scope}>
  <button onClick={handleClick}>Click me</button>
</div>
```

### MotionConfig — Global Animation Settings

Wrap your app (or a subtree) to set defaults like reduced motion or spring presets:

```tsx
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

`reducedMotion="user"` automatically disables animations for users with OS-level "reduce motion" preferences. This is the easiest way to handle accessibility at scale.

### LazyMotion — Bundle Size Optimization

For production apps, replace `motion` with `LazyMotion` + `m` to code-split the animation engine:

```tsx
import { LazyMotion, domAnimation, m } from 'framer-motion';

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />
</LazyMotion>
```

Use `domMax` instead of `domAnimation` if you need drag or layout animations.

## Game UI Patterns

### Health Bar Smooth Tweening

```tsx
const motionWidth = useMotionValue(current / max);
const springWidth = useSpring(motionWidth, { stiffness: 200, damping: 30 });

useEffect(() => {
  motionWidth.set(Math.max(0, Math.min(1, current / max)));
}, [current, max]);

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

### Screen Shake (useAnimate)

```tsx
const [scope, animate] = useAnimate();

const shake = async () => {
  await animate(scope.current, { x: [0, -10, 10, -10, 10, 0] }, { duration: 0.4 });
};

<div ref={scope}>{children}</div>
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

## Accessibility

Always respect the user's motion preferences. Two approaches:

**1. MotionConfig (recommended for apps)** — wraps your entire component tree:
```tsx
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

**2. useReducedMotion hook** — for component-level control:
```tsx
const shouldReduceMotion = useReducedMotion();

<motion.div
  animate={{ opacity: 1, y: shouldReduceMotion ? 0 : -20 }}
/>
```

## Performance

- Animate only `transform` and `opacity` — GPU-composited, no layout/paint triggered
- `will-change: transform` for elements that always animate (promotes to own layer)
- Use `motion.create(Component)` to animate custom components without wrapper divs
- `layout` prop triggers automatic layout animations — expensive on large DOM trees; scope to smallest possible subtree
- Prefer `useMotionValue` over `useState` for animation-driving values — motion values don't trigger re-renders
- `LazyMotion` with `domAnimation` saves ~15kb gzip vs the full bundle

## Setup

```bash
bun add framer-motion
```

Zero-config — no providers required. Import and use `motion.div` directly.

For global accessibility handling, wrap your app root:
```tsx
import { MotionConfig } from 'framer-motion';

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

## Boilerplate

`boilerplate/motion-components.tsx` — ready-to-use components: `FadeIn`, `SlideIn`, `ScaleIn`, `StaggerList`, `FloatingNumber`, `HealthBar`, `AnimatedCard`

`templates/animation-variants.ts` — reusable variant objects and spring transition presets

## Cross-References

- `vercel-react-best-practices` — React performance patterns
- `ui-ux-game` — game HUD and UI patterns
- `frontend-design` — component design and Tailwind patterns

## Pitfalls & Anti-Patterns

- **Animating layout-triggering properties** (`width`, `height`, `top`, `left`) — use `scaleX`/`scaleY` or the `layout` prop instead
- **Forgetting AnimatePresence** when using `exit` prop — exit animations silently skip without the wrapper
- **Creating motion values in render** — use `useMotionValue` hook; creating in render causes memory leaks
- **Using CSS `transition` AND Framer Motion on same element** — they conflict; pick one
- **Over-animating** — every interaction animated is sensory overload; animate to communicate, not to decorate
- **Animating on mount without `initial`** — component flashes before animating; always set `initial`
- **Using `useAnimation`** — deprecated; use `useAnimate` for imperative animations instead
- **Large `layout` animations** — `layout` prop on deeply nested trees causes expensive recalculations; scope to smallest possible subtree
- **Skipping accessibility** — always use `MotionConfig reducedMotion="user"` or `useReducedMotion`

## Sources

- Framer Motion documentation — https://motion.dev
- Matt Perry — Framer Motion creator, API design talks
- Sarah Drasner — "SVG Animations", animation design patterns
- GSAP documentation — https://gsap.com
