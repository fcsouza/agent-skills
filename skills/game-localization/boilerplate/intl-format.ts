/**
 * Locale-aware formatting for game text, over the built-in ECMAScript Intl API.
 * No dependencies. Formatters are cached per locale and options, because
 * constructing them is slower than calling them and HUDs format every frame.
 *
 * On a Bun server, check Intl coverage first (see the skill's check command).
 *
 * Every function throws RangeError for an invalid locale tag, an unknown
 * currency code or an unknown time zone, as the Intl constructors do. Pass one
 * BCP 47 tag (parse an Accept-Language header first), an ISO 4217 code and an
 * IANA zone name; validate values that come from players or headers.
 */

const cache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
	let value = cache.get(key) as T | undefined;
	if (value === undefined) {
		value = make();
		cache.set(key, value);
	}
	return value;
}

/** Plural category for a count, or ordinal category for 1st/2nd/3rd. */
export function pluralCategory(locale: string, n: number, type: Intl.PluralRuleType = 'cardinal'): Intl.LDMLPluralRule {
	return cached(`pr|${locale}|${type}`, () => new Intl.PluralRules(locale, { type })).select(n);
}

export function formatNumber(locale: string, n: number): string {
	return cached(`nf|${locale}`, () => new Intl.NumberFormat(locale)).format(n);
}

/** Short HUD form such as 988M. The exact output depends on the runtime's ICU data; test it, do not snapshot it across runtimes. */
export function formatCompact(locale: string, n: number): string {
	return cached(`nfc|${locale}`, () => new Intl.NumberFormat(locale, { notation: 'compact' })).format(n);
}

/**
 * Real money only, with an ISO 4217 code (`USD`, `BRL`). Soft currency (gold,
 * gems) is not ISO 4217: format the number with formatNumber and put the
 * currency word in the message, where it can take a plural.
 */
export function formatMoney(locale: string, amount: number, currency: string): string {
	return cached(
		`nfm|${locale}|${currency}`,
		() => new Intl.NumberFormat(locale, { style: 'currency', currency }),
	).format(amount);
}

/** "Ana, Bo and Cy" / "Ana, Bo oder Cy". Never join with ", " and " and ". */
export function formatList(locale: string, items: readonly string[], type: Intl.ListFormatType = 'conjunction'): string {
	return cached(`lf|${locale}|${type}`, () => new Intl.ListFormat(locale, { type })).format(items);
}

/**
 * Event window in the player's time zone, not the server's.
 * Pass the zone the client reports (Intl.DateTimeFormat().resolvedOptions().timeZone).
 */
export function formatEventWindow(locale: string, start: Date, end: Date, timeZone: string): string {
	return cached(
		`dtr|${locale}|${timeZone}`,
		() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }),
	).formatRange(start, end);
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
	['year', 365 * 24 * 3600 * 1000],
	['month', 30 * 24 * 3600 * 1000],
	['week', 7 * 24 * 3600 * 1000],
	['day', 24 * 3600 * 1000],
	['hour', 3600 * 1000],
	['minute', 60 * 1000],
	['second', 1000],
];

/**
 * "in 3 days", "yesterday", "5 minutes ago". RelativeTimeFormat does not pick
 * the unit, so this picks the largest unit with a magnitude of at least 1.
 */
export function formatRelative(locale: string, deltaMs: number): string {
	const rtf = cached(`rtf|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
	for (const [unit, ms] of RELATIVE_UNITS) {
		if (Math.abs(deltaMs) >= ms || unit === 'second') return rtf.format(Math.round(deltaMs / ms), unit);
	}
	return rtf.format(0, 'second');
}

/** User-perceived characters. Use for name-length limits, truncation and caret moves. */
export function graphemes(locale: string, text: string): string[] {
	const seg = cached(`sg|${locale}`, () => new Intl.Segmenter(locale, { granularity: 'grapheme' }));
	return Array.from(seg.segment(text), (s) => s.segment);
}

export function truncate(locale: string, text: string, max: number, ellipsis = '…'): string {
	const parts = graphemes(locale, text);
	return parts.length <= max ? text : parts.slice(0, Math.max(0, max - 1)).join('') + ellipsis;
}

/**
 * Word wrap for canvas text, which never wraps on its own. `measure` is
 * usually (s) => ctx.measureText(s).width. Breaks at Intl.Segmenter word
 * boundaries, so Japanese, Chinese and Thai wrap without spaces. It does not
 * apply CJK line-start punctuation rules or French non-breaking spaces; a
 * word wider than maxWidth stays on its own line.
 */
export function wrapLines(locale: string, text: string, maxWidth: number, measure: (s: string) => number): string[] {
	const seg = cached(`sw|${locale}`, () => new Intl.Segmenter(locale, { granularity: 'word' }));
	const lines: string[] = [];
	let line = '';
	const flush = () => {
		lines.push(line.trimEnd());
		line = '';
	};
	for (const { segment } of seg.segment(text.replace(/\r\n?/g, '\n'))) {
		if (segment === '\n') {
			flush();
			continue;
		}
		if (line === '' && segment.trim() === '') continue; // no leading spaces on a line
		if (line !== '' && measure((line + segment).trimEnd()) > maxWidth) {
			flush();
			if (segment.trim() === '') continue;
		}
		line += segment;
	}
	if (line !== '') flush();
	return lines;
}

/** Language-aware sort for leaderboards and inventories sorted by name. */
export function compareNames(locale: string): (a: string, b: string) => number {
	return cached(`co|${locale}`, () => new Intl.Collator(locale)).compare;
}

/** Native language names for the language picker: "Português (Brasil)". */
export function languageName(tag: string): string {
	return cached(`dn|${tag}`, () => new Intl.DisplayNames([tag], { type: 'language' })).of(tag) ?? tag;
}
