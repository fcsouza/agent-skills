# Notice

This skill adapts parts of pstack v0.15.46 by Lauren Tan, https://github.com/cursor/plugins/tree/main/pstack, under the MIT licence below. It is our own text and structure; no upstream file is copied whole.

Upstream files adapted:

- `skills/correct/SKILL.md`: the order of fixes, proving a check on a past mistake, the rule table, the reply format. Changed: two modes, a harness-hook level, an approval rule, exceptions without an expiry field.
- `skills/no-comments/SKILL.md` and `agents/comment-sicko.md`: treating constraint comments as rules to encode, and workaround comments as root-cause signals. Changed: folded into one section; no separate reviewer agent.
- `skills/principle-encode-lessons-in-structure/SKILL.md`: no prose when a structural fix exists.
- `skills/principle-fix-root-causes/SKILL.md`: fix the fault where it starts and every instance of it.
- `skills/principle-type-system-discipline/SKILL.md` and `skills/principle-boundary-discipline/SKILL.md`: branded primitives, parsing at the boundary, schema-derived types.
- `skills/principle-subtract-before-you-add/SKILL.md`: delete dead paths an agent would copy.
- `skills/typescript-best-practices/SKILL.md` and its `references/patterns.md`: the brand shape, type predicates that must really check, exhaustive switches. Changed: recipes rewritten and compiled against TypeScript 6 and Zod 4.
- `docs/guide/08-principles.md`: the principle index used to find the files above.

The thesis section also draws on ideas from Lauren Tan's talk at AI Engineer, published 2026-11-14 (https://www.youtube.com/watch?v=O_zcc6Xl12g). The talk is not covered by the licence below; the skill paraphrases its ideas and quotes none of it.

## Upstream MIT License

MIT License

Copyright (c) 2026 Lauren Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
