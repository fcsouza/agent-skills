---
name: game-localization
description: >-
  Covers localizing a browser game written in TypeScript: string tables with stable IDs, plurals and formatting through the Intl API, message format choice, text expansion, canvas text, right-to-left and CJK layout, fonts, pseudo-localization and the translation process. Use when a game will ship in more than one language, when you add dialogue, HUD labels, quest text or other player-facing strings that will be translated, or when text overflows, wraps badly or shows the wrong plural in another language.
---

# Game localization

Internationalize from the first string: externalize text, format through Intl, and turn on a pseudo locale. Translation comes later and costs far less when the code is ready for it.

## Strings: IDs, comments, whole messages

1. Keep every player-facing string in a resource file per language. Hard-coded text sends translators into source code, where they can break it (IGDA). The client bundle and any server renderer read the same catalog files.
2. Key messages by stable semantic IDs (`quest.ruins.offer`, `hud.gold.label`), not by the English text. One English string can need different translations: Mozilla's example is "bookmark" as noun and verb, and Godot notes the same ambiguity with plain-English source strings, as opposed to message codes.
3. When a string's meaning changes, give it a new ID, so old translations stop matching and translators see it as new (Mozilla). Fixing a typo keeps the ID.
4. Never reuse one string in two places. A noun and a verb that look the same in English get two entries (Mozilla).
5. Give each message a translator comment: where it shows, what each placeholder holds, what must stay untranslated, and a length budget for fixed-size UI. Keep it in the catalog next to the message, not in code the translator never sees. Fluent binds a comment placed right above a message to it, and tools show both together.
6. Never build a sentence from fragments. Write one message with named placeholders, so translators can reorder the pieces (ICU, Mozilla). Ban template-literal sentences such as `` `${name} found ${n} ${item}` `` in client and server code.
7. When an inserted part cannot agree with the fixed text (item names in loot toasts, quest names in log lines), use a topic-comment layout: "Picked up: {item}", not "You picked up a {item}". The fixed text then needs no gender or number agreement (W3C).
8. Inside plural or select messages, write a full sentence in each branch. Put select outside and nest plural inside it (ICU).
9. Prefer repeating text across messages to sharing fragments. Use variants only for grammar, and separate messages for UI logic (Fluent good practices).
10. Keep brand names and glossary terms as referenced terms, so one change updates every message (Fluent terms).

Copy `boilerplate/string-table.ts` when you need a typed string table: IDs typed from the source table, a comment and optional length budget on every entry, plural messages that require `other`, the fallback chain below, catalogs loaded in parallel, and failed loads recorded in `loadErrors` instead of failing the whole table. Its `{name}` placeholders and plural maps are a minimal stand-in, not ICU MessageFormat. Move to a real message format when a message needs gender or nested choices.

## Locale fallback chain

Resolve from most to least specific, then the default locale: zh-Hans-CN, zh-CN, zh-Hans, zh, then en. Unreal processes cultures in that order. Add the likely script for a tag that has only a region, so zh-TW reaches a zh-Hant catalog (zh-TW, zh-Hant-TW, zh-Hant, zh); the boilerplate does this with `Intl.Locale.prototype.maximize()`. Unity lets each locale list its fallbacks. Godot falls back to a project fallback locale, or to en.

- Treat regional variants as separate locales: pt and pt-BR, es and es-419, zh-Hans and zh-Hant. Steam lists Portuguese and Portuguese-Brazil, and Spanish-Spain and Spanish-Latin America, as separate languages.
- Use BCP 47 tags inside the game. Convert at the platform edge: Steam's API codes map `brazilian` to pt-BR, `latam` to es-419, `schinese` to zh-CN.
- Resolve the chain once per message ID when the catalogs load, and log misses and failed loads in development. The boilerplate does both.
- Intl throws RangeError on an invalid tag, currency code or time zone. Parse an Accept-Language header into one tag before passing it, and validate player-supplied values.
- Format plurals and numbers with the locale the text came from. A Russian player who falls back to English text should not get Russian plural categories applied to English branches.

## Plurals and formatting: use Intl

Do not hard-code singular and plural. CLDR gives English one and other; Russian and Polish one, few, many and other; Arabic all six categories; Japanese only other. Brazilian Portuguese (pt) and French put 0 in `one`; European Portuguese (pt-PT) does not. Every plural or select message needs a default branch: `other` in ICU syntax, `*` in Fluent.

| Need | Intl member | Note |
|---|---|---|
| Plural branch, 1st/2nd/3rd | `Intl.PluralRules` | `type: 'ordinal'` for ordinals |
| Counts, HUD numbers | `Intl.NumberFormat` | `notation: 'compact'` for short forms |
| Real money | `Intl.NumberFormat` | `style: 'currency'` has no default currency; pass an ISO 4217 code |
| Event times | `Intl.DateTimeFormat` | set `timeZone` to the player's zone; `formatRange` for windows |
| "in 3 days", "yesterday" | `Intl.RelativeTimeFormat` | you pick the unit; `numeric: 'auto'` gives words |
| Reward lists, party names | `Intl.ListFormat` | conjunction, disjunction or unit; never join with ", " and " and " |
| Name length, truncation, wrapping | `Intl.Segmenter` | grapheme for length, word for Japanese, Chinese, Thai |
| Sorting names | `Intl.Collator` | leaderboards, inventories |
| Language picker | `Intl.DisplayNames` | language names in their own language |

In-game soft currency (gold, gems) is not ISO 4217. Format the number with `NumberFormat` and put the currency word in the message, where it can take a plural.

Copy `boilerplate/intl-format.ts` when you need these helpers with cached formatters: plural and ordinal category, compact numbers, money, lists, event windows in the player's zone, relative time with the unit picked for you, grapheme truncation, canvas word wrap, name sorting and language names.

Test plural messages with 0, 1, 2, 3, 5, 11, 21, 100 and 1000000 in every shipped locale. Those numbers hit different categories across Arabic, Russian, Polish, both Portuguese variants and French.

### Check Intl on the server runtime

Browsers have these members: MDN marks `Intl.PluralRules` baseline since September 2019, `RelativeTimeFormat` since September 2020, `ListFormat` since April 2021 and `Segmenter` since April 2024. Bun's Web APIs page does not list Intl. Before server code relies on Intl, run this on the target Bun version:

```bash
bun -e 'for (const k of ["PluralRules","NumberFormat","DateTimeFormat","ListFormat","RelativeTimeFormat","Segmenter","DisplayNames","Collator"]) console.log(k, k in Intl); console.log(new Intl.PluralRules("ar").select(3), new Intl.PluralRules("pt").select(0), Intl.DateTimeFormat.supportedLocalesOf(["ar","ja","th","pt-BR"]))'
```

Every line should print `true`, then `few one` and all four locales. On Bun 1.4.4 on 2026-11-14 it did. That is one observation, not a documented guarantee: run it again in CI on the version you deploy, and add your shipped locales to the list.

## Message format choice

| Option | Status checked 2026-11-14 | Pick when |
|---|---|---|
| The boilerplate's `{name}` plus plural map | Code in this skill | Few plural strings, no gender, no nested choices |
| ICU MessageFormat (classic) | ICU documents plural and select arguments and full-sentence branches | Many plural or gender messages, translators or tools that already read ICU syntax |
| Fluent | Comments bound to messages, terms with variants, required default variant | Text-heavy games with brand terms and grammar that varies by language |
| MessageFormat 2 | Unicode TR35 Part 9, CLDR 49, stable; functions marked Draft may still change. In ICU4C and ICU4J. The TC39 `Intl.MessageFormat` proposal is at Stage 1 | A JS library you choose supports it; do not wait for native support |

No native JavaScript message formatter ships today: ICU MessageFormat, Fluent and MF2 all need a library on Bun and in browsers. Pick the library from its own documentation and pin its version. This skill names none because none was checked.

## Text, layout, scripts and fonts

Short strings grow the most. W3C, quoting IBM, gives 200 to 300 percent for English strings of up to 10 characters and about 130 percent for strings over 70. Buttons and HUD labels break first. Let text reflow and avoid small fixed-width boxes.

Canvas `fillText` never wraps; its `maxWidth` squeezes or shrinks the text instead. Wrap with `wrapLines` from the boilerplate, or draw long text in DOM overlays. In a DOM overlay, insert translated text and player names with `textContent`, never `innerHTML`: a catalog or a player name can carry markup. That is this skill's own rule.

Read `references/text-layout.md` when you lay out HUD, menus, dialogue boxes or subtitles for more than one language: expansion budgets, canvas wrapping, right-to-left and bidi, CJK and Thai line breaking, French punctuation, fonts and glyph coverage, text in images and video, player names.

## Pseudo-localization from day one

Run a pseudo locale from the first build, before any translation (Microsoft). It shows:

- strings missing from the catalog: they appear plain, untransformed;
- truncation and overflow: padding lengthens text (Microsoft suggests 40 percent) and a cut-off bracket shows where;
- concatenation: two bracket pairs inside one label;
- font gaps: accented letters the font cannot draw;
- right-to-left layout bugs: mirrored text (Unity's Mirror, Godot's `fake_bidi`).

Name the pseudo locale with a tag that is not a real language. Microsoft once used tk-TM; when Windows later shipped Turkmen, the clash caused bugs. ICU reserves en-XA (accents) and en-XB (bidi); Windows uses the qps- range.

Copy `boilerplate/pseudo-localize.ts` when you add the pseudo locale: it accents letters, pads, brackets, optionally mirrors, keeps `{placeholders}`, tags, entities and printf tokens intact, and builds a catalog under en-XA from the source table. It understands only this boilerplate's `{name}` syntax; for ICU or Fluent messages use the library's own pseudo-locale, since this one would accent ICU keywords such as `plural` and `one`. Intl resolves en-XA to en (checked on Bun 1.4.4), so numbers and plurals format as English. Serve it in development builds only.

## Process

Read `references/process.md` when you plan translation work or a content patch: glossary and style guide, context for translators, string freeze, the live-game cycle, LQA and culturalization.

The short version: give translators builds, context, a glossary, a style guide and name pronunciations before they start; freeze source text on a date the team commits to; run each live content patch as its own small localization cycle; regress localization fixes on more than one build; let the lead translator make the final call; change as little content as possible when culturalizing.

Store pages and in-game text are separate jobs. Steam decides language support from the in-game language settings, not the store page, and declares it per language as Interface, Full Audio or Subtitles.

## Pitfalls

- Fixing a meaning change in place, so old translations still match the ID (rule 3).
- A template literal or `+` joining translated pieces anywhere in UI code (rule 6). Search for it in review.
- Sizing UI for English, or for an average 30 to 40 percent, when short labels grow 200 to 300 percent (W3C).
- Assuming one/other plurals, or that pt and pt-PT share rules: pt puts 0 in `one`, pt-PT does not (CLDR).
- Splitting text on spaces: breaks Japanese, Chinese and Thai (MDN `Intl.Segmenter`). Slicing by code units splits emoji and accented letters; count graphemes.
- Relying on canvas `fillText` to wrap (MDN).
- Setting direction in CSS, or aligning left and right, for right-to-left text (W3C).
- Inserting a player name into right-to-left text without isolation (W3C).
- One CJK font for both Chinese and Japanese (W3C).
- A default font that cannot draw the target scripts (Godot).
- Text burned into textures or video (IGDA).
- A real locale code as the pseudo locale (Microsoft).
- Translating while the source text still changes (IGDA).
- Server code that formats with Intl on a runtime nobody checked.

## Files

- `boilerplate/string-table.ts`: copy when you need typed message IDs, translator comments, plural messages and the fallback chain.
- `boilerplate/intl-format.ts`: copy when you format numbers, money, dates, lists or relative time, or truncate or wrap text for canvas.
- `boilerplate/pseudo-localize.ts`: copy when you add the pseudo locale.
- `references/text-layout.md`: read when you lay out text for more than one language or script.
- `references/process.md`: read when you plan translation, a string freeze, LQA or culturalization.
- `references/sources.md`: read when you need the page behind a claim above.

## Related skills

- `ui-ux-game` (HUD, menus, subtitles and font-size options)
- `character-design-narrative` (character bibles and the dialogue-tree format whose lines become string-table entries)
- `quest-mission-design` (quest names, objective text)
- `worldbuilding` (world bible, factions and culture; the names and real-world parallels to review for culturalization)
