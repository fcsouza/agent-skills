# Notice

This skill adapts parts of pstack v0.15.46 by Lauren Tan, from https://github.com/cursor/plugins (the `pstack` plugin), under the MIT License below. The text is rewritten, merged and restructured; no upstream file is copied whole.

Upstream files adapted:

- `skills/create-verification-skill/SKILL.md`: the five interview questions, the broken-base rule, the generated sections, the proof standards, the feature map contract and the proof run. Here: Create mode in `SKILL.md`, `references/create.md`, `references/proof-standards.md` and `references/verify-skill-template.md`.
- `skills/create-verification-skill/references/feature-map-example/` (`README.md`, `create-note.md`, `search.md`): the shape of the index and the feature files. Here: `references/feature-map-example/`, rebuilt from a proof run of this skill on a different sample app.
- `skills/maintain-verification-skill/SKILL.md`: edit scope, the three outcomes, parallel source readers, the live pass invariants and triage. Here: Maintain mode in `SKILL.md` and `references/maintain.md`.
- `docs/guide/06-verify-and-ship.md`, sections "State the finish condition up front", "Create a project verification skill" and "Keep the verification skill honest": the traits of a control CLI and the case for committing the verify skill. Here: `references/control-cli.md`.
- `skills/principle-prove-it-works/SKILL.md`: check the real artifact, not a proxy. Here: `references/proof-standards.md`.
- `skills/principle-build-the-lever/SKILL.md`: build the smallest tool that does or proves the job. Here: `references/control-cli.md`.
- `automations/benny/skills/reproduce-and-fix-issues/references/control-adapter.md`: driving through real user actions, stable handles, read-only inspection, cleanup that keeps user work. Here: `references/drive-options.md` and `references/proof-standards.md`.

Changes: one skill with two modes; Claude Code skill paths, frontmatter and `${CLAUDE_SKILL_DIR}`; readers as `Agent` calls with a fixed brief; a driver order for Claude Code; a working control CLI (`references/control-cli-example.ts`); lessons from a proof run (wrapper process IDs, helper paths in feature files, scoped assertions, short timeouts, finding unmapped surfaces with `git diff`).

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
