# Sources

Checked 2026-11-15 against `motion` 14.14.0 and React 19.3.1.

- Motion, "Installation guide for Motion for React" (motion.dev, 2026) - https://motion.dev/docs/react-installation.md - supports: install `motion`, import from `motion/react`, `motion/react-client` in Next.js server files, React 18.2 or later - checked 2026-11-15
- Motion, "Upgrade guide" (motion.dev, 2026) - https://motion.dev/docs/react-upgrade-guide.md - supports: version 14 has no breaking changes; the AI Kit upgrades projects - checked 2026-11-15
- Motion, "Accessibility" (motion.dev, 2026) - https://motion.dev/docs/react-accessibility.md - supports: `reducedMotion="user"` disables transform and layout animations and keeps opacity and backgroundColor; `"always"` and `"never"` overrides; `useReducedMotion` - checked 2026-11-15
- Motion, "Reduce bundle size" (motion.dev, 2026) - https://motion.dev/docs/react-reduce-bundle-size.md - supports: `motion` 43 kB, `m` about 5 kB, `domAnimation` +24 kB, `domMax` +38 kB with drag and layout, `useAnimate` mini 3.3 kB on WAAPI, `motion/react-m` import - checked 2026-11-15
- Motion, "LazyMotion" (motion.dev, 2026) - https://motion.dev/docs/react-lazy-motion.md - supports: the `strict` prop throws when a `motion` component renders inside `LazyMotion` - checked 2026-11-15
- Motion, "useAnimate" (motion.dev, 2026) - https://motion.dev/docs/react-use-animate.md - supports: `useAnimate` scoped animation, mini import from `motion/react-mini` - checked 2026-11-15
- Motion, "Animation" (motion.dev, 2026) - https://motion.dev/docs/react-animation.md - supports: enter animation runs from first-rendered values to `animate`; `initial={false}` renders at the `animate` values - checked 2026-11-15
- Motion, "useReducedMotion" (motion.dev, 2026) - https://motion.dev/docs/react-use-reduced-motion.md - supports: the hook returns true when the device Reduced Motion setting is on - checked 2026-11-15
- Motion, "Motion component" (motion.dev, 2026) - https://motion.dev/docs/react-motion-component.md - supports: `motion.create` must not run in render, wrapped component must pass a ref, motion values avoid re-renders - checked 2026-11-15
- Motion, "AnimatePresence" (motion.dev, 2026) - https://motion.dev/docs/react-animate-presence.md - supports: modes sync, wait (one child), popLayout (custom children forward the ref, non-static parent position) - checked 2026-11-15
- Motion, "AnimateView" (motion.dev, 2026) - https://motion.dev/docs/react-animate-view.md - supports: built on React `ViewTransition`, needs React and React DOM 19.3 or later - checked 2026-11-15
- Motion, "3D transforms and perspective" (motion.dev, 2026) - https://motion.dev/docs/3d-transforms.md - supports: card flip uses `perspective` on the parent, `transform-style: preserve-3d` on the card, `backface-visibility: hidden` on faces, back face `transform: rotateY(180deg)` - checked 2026-11-15
- Motion, "llms.txt" (motion.dev, 2026) - https://motion.dev/llms.txt - supports: docs index for agents, `.md` suffix on docs pages, mcp.motion.dev, AI Kit pointers - checked 2026-11-15
- Motion, "Motion MCP server" (mcp.motion.dev, 2026) - https://mcp.motion.dev - supports: free hosted MCP server with `search-motion-docs` - checked 2026-11-15
- Motion, "Install the Motion AI Kit" (motion.dev, 2026) - https://motion.dev/docs/ai-kit-install - supports: `npx motion-ai` installs the `/motion` skill and configures the MCP server - checked 2026-11-15
- Motion, "ai-kit" (GitHub, 2026) - https://github.com/motiondivision/ai-kit - supports: official source of the Motion AI Kit skill - checked 2026-11-15
- npm, "motion" 14.14.0 (npmjs.com, 2026) - https://www.npmjs.com/package/motion - supports: `motion` depends on `framer-motion` at the same version (read from the installed package.json), so it is the same code - checked 2026-11-15
- This skill's rule, with the docs index https://motion.dev/llms.txt as evidence: `useAnimation` is not listed in the current docs, so the skill calls it undocumented, not deprecated - checked 2026-11-15
