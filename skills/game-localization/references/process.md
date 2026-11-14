# Localization process

## Before translation

- Proofread the source text for spelling, grammar and style before you send it (IGDA).
- Give translators time with the game and its documents before they translate: IGDA suggests at least 3 days of play and reading for a small title and a month or more for a large MMORPG.
- Give them builds, design documents and screenshots of each string in place. A string with no context gets guessed.
- Provide a source glossary, style guide and pronunciation of key terms. Each target language builds its own glossary and style guide from them (IGDA).
- Record why names were chosen or changed, so later translators and other languages can decide whether to follow them (IGDA).
- Settle names early. IGDA puts naming at about a week for a small title and up to 6 weeks for a large MMORPG.
- Review culturalization risk as soon as a design document and concept art exist (IGDA).

## String freeze

- Get the team to commit to a date after which source text stops changing. Localization cannot finish while the source keeps moving (IGDA).
- Ship each localized build with a list of source text changes (IGDA). Generate it in CI by diffing the source catalog between releases.
- Tell translators which sections are stable. IGDA's traffic light: green is stable, orange may still change slightly, red is translate at your own risk.

## Live games

- Treat each content patch as its own localization cycle, with the same stages on a smaller scale (IGDA).
- Keep a linguist on call after sign-off (IGDA).

## LQA

- Report linguistic bugs and general suggestions separately, so real bugs get priority (IGDA).
- Regress each fix on more than one build. Old text often comes back in a new build (IGDA).
- Deliberate changes can look like bugs; the translator must justify a waiver (IGDA).
- When QA and translators disagree, the lead translator decides (IGDA).
- Run the pseudo locale in every build before LQA starts, so layout and concatenation bugs never reach linguists.

## Culturalization

- Check four areas where content most often conflicts with local cultures: history, religion and belief systems, ethnicity and cultural friction, and geopolitics (IGDA).
- Content that closely copies real places, people, maps or religious material carries the most risk. Kakuto Chojin was discontinued after backlash over a chanted passage of the Qur'an (IGDA).
- Be surgical: make the smallest change to the least content that allows release in the market (IGDA).
- Add a "cultural" bug type to the tracker and record each decision with its reason.
- Avoid near copies of real cultures and stereotypes in fiction; Ocean Drive Studio did this when it localized Lost Eidolons.
