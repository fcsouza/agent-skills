# Sources

Read on 2026-11-22. Claims marked "seen here" in the other files come from running `@antithesishq/bombadil` 0.8.0 locally, not from these pages.

- Bombadil manual (introduction, getting started, specification language, workflows, CLI reference): https://antithesishq.github.io/bombadil/
- Bombadil source, examples and changelog: https://github.com/antithesishq/bombadil
- Browser spec types (`Action`, `State`, `Fingerprint`) in v0.8.0: https://github.com/antithesishq/bombadil/blob/v0.8.0/lib/bombadil/src/specification/browser/index.ts
- Terminal spec types (`Action`, `State`, `Grid`) in v0.8.0: https://github.com/antithesishq/bombadil/blob/v0.8.0/lib/bombadil/src/specification/terminal/index.ts
- Browser default actions and their weights in v0.8.0: https://github.com/antithesishq/bombadil/blob/v0.8.0/lib/bombadil/src/specification/browser/defaults.ts
- The npm package `@antithesishq/bombadil`: https://www.npmjs.com/package/@antithesishq/bombadil
- GitHub Action inputs, outputs and example workflows: https://github.com/antithesishq/bombadil-action
- Property-based testing guide from Antithesis: https://antithesis.com/docs/resources/property_based_testing/
- Chrome extension match patterns, the syntax of `--allow-url`: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
- Talk that motivated this skill, where a team describes verification taking most of their agents' tokens and Bombadil as their UI property-testing layer ("All Code Is Slop (Except Mine)", AI Engineer, 2026-11-14): https://www.youtube.com/watch?v=O_zcc6Xl12g
