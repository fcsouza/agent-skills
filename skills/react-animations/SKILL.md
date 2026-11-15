---
name: react-animations
description: >-
  Motion for React (the `motion` package): choosing between CSS and Motion, exit animations, reduced-motion handling, bundle size, and game HUD effects such as health bars, damage numbers, card flips and screen shake. Use when adding or fixing in-component animation in a React app that uses, or should use, Motion. Not for other animation libraries or for route changes.
---

# React animations with Motion

Motion is the library formerly named Framer Motion. `framer-motion` publishes the same code under the old name, so existing projects keep working. New code installs `motion` and imports from `motion/react`.

## Use the official Motion tooling first

Use the `motion` skill (Motion AI Kit) if it is installed, otherwise run `bunx motion-ai` or read https://github.com/motiondivision/ai-kit. It also configures the docs MCP server at https://mcp.motion.dev. For API details, read https://motion.dev/llms.txt. Every docs page serves Markdown when you add `.md` to its URL. This skill keeps only the decisions and the game-UI recipes those sources do not hold.

## Choose the tool

| Need | Use |
|---|---|
| Hover, focus, simple fades | CSS `transition` (Tailwind). Do not add Motion for this. |
| Enter and exit of conditional elements, variants, gestures, drag, layout and `layoutId` | `motion` components with `AnimatePresence` |
| Values driven by input or game state (bars, counters) | `useMotionValue`, `useSpring`, `useTransform` |
| One-off imperative sequences (shake, pulse) | `useAnimate` |
| Timelines, ScrollTrigger, SVG drawing | GSAP. Use the `gsap-react` skill. |
| Native page and route transitions | The `vercel-react-view-transitions` skill. Use Motion's `AnimateView` (`import { AnimateView } from 'motion/react-animate-view'`, not `motion/react`) only if the project already uses Motion. It needs React and React DOM 19.3 or later. |

## Setup

```bash
bun add motion
```

```tsx
import { motion } from 'motion/react';
```

In a Next.js App Router server file, use `import * as motion from 'motion/react-client'`. Otherwise add `'use client'`.

## Rules that save debugging time

1. Animate `transform` and `opacity`. Animating `width`, `height`, `top` or `left` forces layout work. Use `scaleX`, `scaleY` or the `layout` prop.
2. Wrap conditional elements in `AnimatePresence`, or `exit` never runs. Give each child a stable `key`.
3. Put variants outside the component so they keep one identity.
4. Drive animation values with motion values, not `useState`. Motion values update without re-rendering the component.
5. Do not mix a CSS `transition` and Motion on one element. They fight over the same property.
6. An element animates on mount from its first-rendered values to `animate`. Set `initial` to choose the start. If those values already match `animate`, nothing plays. `initial={false}` renders at the `animate` values with no enter animation.
7. Call `motion.create(Component)` at module level, never inside a render. The component you wrap must forward its `ref`.

`AnimatePresence` modes: `"sync"` (default), `"wait"` (one child only), `"popLayout"` (custom children must forward `ref`; give the animating parent a non-static `position`).

## Reduced motion

Set it once at the app root:

```tsx
import { MotionConfig } from 'motion/react';

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

`"user"` turns off transform and layout animations. It keeps animations of other values such as `opacity` and `backgroundColor`. It does not stop every animation. For effects that are large movement by design (shake, parallax, big slides), read `useReducedMotion()` and skip or swap them for a fade. `ScreenShake` in `boilerplate/motion-components.tsx` does this. `"always"` and `"never"` let a user setting override the OS value. `useReducedMotion()` reports the device setting. Do not rely on it to reflect a `MotionConfig` override.

## Bundle size

`motion` is about 43 kB gzipped. `LazyMotion` with `m` starts near 5 kB. Add `domAnimation` (+24 kB) for animations, variants, exit and hover, tap and focus gestures. Add `domMax` (+38 kB) for drag and layout animations instead.

```tsx
import { LazyMotion, domAnimation } from 'motion/react';
import * as m from 'motion/react-m';

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />
</LazyMotion>
```

Pass `strict` to `LazyMotion` to throw if a `motion` component slips in. `useAnimate` has a mini version at `motion/react-mini`, about 3.3 kB, that runs on WAAPI only.

## Game HUD recipes

The working code is in `boilerplate/motion-components.tsx`. Copy the component, then adjust numbers.

| Effect | Component | How it works |
|---|---|---|
| Health or XP bar | `HealthBar` | `useSpring` on a motion value, applied as `scaleX` with `transformOrigin: 'left'`. Clamp the ratio to 0..1. |
| Damage or score pop-up | `FloatingNumber` | Animates `y` and `opacity`, calls `onComplete` so the parent removes it. |
| Card flip | `AnimatedCard` | See below. |
| Screen shake | `ScreenShake` | `useAnimate` on a keyframe array of `x`, skipped under reduced motion. |
| Menu slide | `SlideIn` inside `AnimatePresence` | Ease on `x`; under reduced motion it drops the `x` offset and keeps a short opacity fade. |

Card flip needs three things. Put `perspective` on the parent. Put `transformStyle: 'preserve-3d'` on the element that rotates. Give each face `backfaceVisibility: 'hidden'`, with the back face at `transform: 'rotateY(180deg)'`. Animate `rotateY` on the rotating element through `animate`. In Motion `rotateY` is a style shorthand, so a plain `div` needs the `transform` string instead.

## Pitfalls

- Using `AnimatePresence` with `mode="wait"` and several children. It supports one child.
- A `motion` component imported from `motion/react` inside a `LazyMotion strict` tree. Import `m` from `motion/react-m`.
- Treating `reducedMotion="user"` as "no animation". Opacity and color animations still run.
- Putting `perspective` on the rotating element. It must be on the parent.
- Exposing an imperative handle from an effect with empty deps. The parent keeps a stale closure. List the handle in the deps, as `ScreenShake` does.
- Large `layout` trees. Layout animation measures the DOM. Scope `layout` to the smallest subtree.
- Using `useAnimation`. Current docs do not list it. Use `useAnimate`.
- Over-animating. Animate to show a state change, not to decorate.

## Files

- `boilerplate/motion-components.tsx` - copy when you need `FadeIn`, `SlideIn`, `ScaleIn`, `StaggerList`, `FloatingNumber`, `HealthBar`, `AnimatedCard` or `ScreenShake`.
- `templates/animation-variants.ts` - copy when you want shared variant objects, spring presets or a stagger container factory.
- `references/sources.md` - read when you need the page behind a claim in this skill.

## Related skills

- `gsap-react` - timelines, ScrollTrigger and SVG drawing.
- `vercel-react-view-transitions` - native page and route transitions.
- `ui-ux-game` - HUD layout and game UI patterns.
- `vercel-react-best-practices` - React performance patterns.
