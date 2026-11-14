/**
 * Pseudo-localizer. Builds a fake catalog from the source table so layout,
 * truncation, concatenation and font bugs show up before any translation.
 *
 * - Accents every ASCII letter: missing font glyphs and hard-coded strings
 *   (which stay plain) stand out.
 * - Pads by `expansion` (default 0.4): truncation and overflow show.
 * - Wraps in [ ]: a cut-off bracket means truncation; two bracket pairs in one
 *   label mean concatenated fragments.
 * - `mirror` reverses text to approximate right-to-left layout.
 * - Leaves `{placeholders}`, HTML-like tags (`<b>`), entities (`&amp;`) and
 *   printf tokens (`%s`, `%1$d`) untouched, so the message still formats.
 *
 * It understands only the boilerplate's `{name}` syntax. It would accent ICU
 * keywords (`plural`, `one`) and Fluent syntax and break those messages: for
 * ICU or Fluent catalogs, use the pseudo-locale feature of that library.
 *
 * Register it under a tag that is not a real language: en-XA (ICU's accented
 * pseudo locale). Intl resolves en-XA to en, so numbers and plurals format as
 * English while the text is pseudo.
 */

import type { Catalog, Message, MessageId, SourceTable } from './string-table';

export const PSEUDO_LOCALE = 'en-XA';

const ACCENTS: Readonly<Record<string, string>> = {
	a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
	n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
	A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Đ', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
	N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

// Placeholders, tags, entities and printf tokens pass through unchanged.
const PROTECTED = /(\{\w+\}|<[^<>]*>|&(?:#\d+|#x[0-9a-fA-F]+|\w+);|%(?:\d+\$)?[-+0#]*\d*(?:\.\d+)?[sdifuxXoeEgGc@%])/;

export interface PseudoOptions {
	readonly expansion?: number;
	readonly brackets?: boolean;
	readonly mirror?: boolean;
}

const isTag = (text: string) => text.startsWith('<');

/**
 * Reverses text and placeholders between tags; tags stay where they are, so
 * <b>...</b> keeps its opening and closing order.
 */
function mirrorParts(parts: ReadonlyArray<{ keep: boolean; text: string }>): Array<{ keep: boolean; text: string }> {
	const out: Array<{ keep: boolean; text: string }> = [];
	let run: Array<{ keep: boolean; text: string }> = [];
	const flush = () => {
		for (const p of run.reverse()) out.push(p.keep ? p : { keep: false, text: Array.from(p.text).reverse().join('') });
		run = [];
	};
	for (const p of parts) {
		if (p.keep && isTag(p.text)) {
			flush();
			out.push(p);
		} else {
			run.push(p);
		}
	}
	flush();
	return out;
}

export function pseudoLocalize(text: string, options: PseudoOptions = {}): string {
	const { expansion = 0.4, brackets = true, mirror = false } = options;
	// split() with a capture group puts the protected tokens at odd indexes.
	const parts = text
		.split(PROTECTED)
		.map((part, i) => ({ keep: i % 2 === 1, text: part }))
		.filter((p) => p.text !== '')
		.map((p) => (p.keep ? p : { keep: false, text: Array.from(p.text, (ch) => ACCENTS[ch] ?? ch).join('') }));
	const ordered = mirror ? mirrorParts(parts) : parts;
	const visible = ordered.reduce((n, p) => n + (p.keep ? 0 : Array.from(p.text).length), 0);
	const body = ordered.map((p) => p.text).join('') + '~'.repeat(Math.ceil(visible * expansion));
	return brackets ? `[${body}]` : body;
}

const OTHER_CATEGORIES = ['zero', 'one', 'two', 'few', 'many'] as const;

function pseudoMessage(message: Message, options: PseudoOptions): Message {
	if (typeof message === 'string') return pseudoLocalize(message, options);
	const out: { other: string } & Partial<Record<(typeof OTHER_CATEGORIES)[number], string>> = {
		other: pseudoLocalize(message.other, options),
	};
	for (const category of OTHER_CATEGORIES) {
		const text = message[category];
		if (text !== undefined) out[category] = pseudoLocalize(text, options);
	}
	return out;
}

/** Serve this from `load` when the locale is PSEUDO_LOCALE, in development builds only. */
export function buildPseudoCatalog<T extends SourceTable>(source: T, options: PseudoOptions = {}): Catalog<MessageId<T>> {
	const catalog: Partial<Record<MessageId<T>, Message>> = {};
	for (const id of Object.keys(source) as Array<MessageId<T>>) {
		catalog[id] = pseudoMessage(source[id].message, options);
	}
	return catalog;
}
