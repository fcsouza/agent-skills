# Text layout across languages and scripts

## Expansion budgets

| English source length | Average expansion (W3C, quoting IBM) |
|---|---|
| Up to 10 characters | 200 to 300 percent |
| 11 to 20 | 180 to 200 percent |
| 21 to 30 | 160 to 180 percent |
| 31 to 50 | 140 to 160 percent |
| 51 to 70 | 151 to 170 percent (as printed; it breaks the trend) |
| Over 70 | 130 percent |

Averages from other sources run lower: Mozilla says design for at least +30 percent, IGDA says size fixed boxes for 30 to 40 percent, Microsoft pads pseudo text by 40 percent and notes some strings run 200 or even 400 percent longer. Size labels and buttons by the table above, not by the averages.

- Wrap text automatically, and allow a manual override (IGDA).
- When a single line cannot fit, scroll it or open it in a pop-up rather than cutting words (IGDA).
- Store a `maxLength` budget in graphemes on entries for fixed-size UI, and check translations against it in CI. The boilerplate's `SourceEntry` has the field.

## Canvas and WebGL text

- `fillText` never wraps. With `maxWidth`, the browser adjusts kerning, picks a condensed face or scales the font down to fit (MDN). Use `maxWidth` only as a last-resort squeeze.
- Wrap with `wrapLines` from `boilerplate/intl-format.ts`: it breaks at `Intl.Segmenter` word boundaries and measures with your `ctx.measureText`.
- `wrapLines` does not apply CJK line-start rules: in a test it left "。" alone at the start of a line. Add a pass that pulls closing punctuation back onto the previous line before you ship Japanese or Chinese on canvas, or draw that text in the DOM, where the CSS `line-break` property sets how CJK lines break around punctuation (MDN).
- Set `ctx.direction` for right-to-left text, and align with `textAlign` `'start'` and `'end'`. `'start'` aligns left in left-to-right locales and right in right-to-left ones; `'left'` and `'right'` never change (MDN). `direction` defaults to `'inherit'` from the canvas element or document.
- Wait for web fonts before drawing: `document.fonts.load()` returns a promise that fulfils when the fonts are loaded and rejects if one fails (MDN). Text drawn earlier uses a fallback font and may measure wrong.

## Right-to-left and bidi in the DOM

- Put `dir="rtl"` on the `html` element. Never set the base direction with CSS (W3C). A server renderer emits `lang` and `dir` on `<html>` per request.
- Use logical start and end for margins, padding and alignment, and CSS logical properties, so the layout mirrors without a second stylesheet (W3C, MDN).
- Wrap inserted text whose direction you cannot predict (player names, guild names, chat) in `<bdi>`, or add `dir="auto"` to the element that wraps it. Both isolate the text and take its direction from its first strong character (W3C).

## CJK, Thai and other scripts

- Declare `lang` on content. Chinese, Japanese and Korean share code points for many ideographs, but readers expect the glyphs to differ in detail (W3C). Ship a font per locale; one CJK font for Chinese and Japanese is wrong for one of them.
- Hyphenation rules depend on the language (W3C).
- Japanese, Chinese, Thai, Lao, Khmer and Myanmar put no spaces between words, so `split(' ')` fails (MDN `Intl.Segmenter`). Thai and Khmer line breaking needs dictionary lookup (W3C); `Intl.Segmenter` with `granularity: 'word'` does this for you where the runtime has the data.
- Most scripts forbid starting a line with punctuation that ends a phrase (W3C).
- French puts a space before `! ? ; :` and around double quotation marks. Have French translators use a non-breaking space (U+00A0) or a token, and have the wrapper treat it as a non-break, or the mark lands alone on the next line (IGDA).
- Use UTF-8 for every file and column that holds text (IGDA).

## Fonts and glyph coverage

- Check that the font draws every character of every target language. Godot's default font covers only a subset of Latin-1 and cannot show Russian or Chinese; Godot points to the Noto fonts (Godot docs).
- Load script-specific fonts with `unicode-range`. A font downloads only if the page uses a character in its range (MDN).
- Have native speakers approve the font before translation starts: accents, readability of Chinese characters, the feel of the face (IGDA).

## Text in images, video and voice

- Track every place text appears in textures and models, and plan to redraw it per language, or use icons and symbols instead of text (IGDA).
- Render subtitles over video at run time, not burned in. Burned-in subtitles force a re-render for every subtitle fix in every language (IGDA). See the subtitle items in the `ui-ux-game` accessibility checklist.

## Player and character names

- Do not force a given/family split. A single full-name field is simpler where you can use it; allow long names, spaces, hyphens and apostrophes, and ask separately how to address the player ("What should we call you?") (W3C).
- Limit name length in graphemes (`graphemes` in the boilerplate), not code units, and normalize Unicode before a uniqueness check.
- A character designed as genderless in English still needs a grammatical gender in some languages. Give translators each character's background and gender (Alconost, on igda.org). Pass gender as a select argument once you use a message format that has select.
- Rename characters and places per language when the original sounds wrong for the setting (Ocean Drive Studio renamed Ethan to Eden in Lost Eidolons). Their team joined after more than a year of development.
