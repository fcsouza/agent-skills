/**
 * Typed string table with a locale fallback chain.
 *
 * - Message IDs are stable semantic keys (`quest.ruins.offer`), typed from the
 *   source table, so a missing or misspelt ID is a compile error.
 * - Every source entry carries a translator comment. Export it with the
 *   message to the translation tool; translators never see this code.
 * - Placeholders are `{name}`. Plural messages are objects keyed by CLDR plural
 *   category and select on the `count` argument. This is a minimal stand-in,
 *   not ICU MessageFormat or Fluent: no select, no nesting, no escaping. Move to
 *   a real message format when a message needs gender or nested choices.
 * - No fetch, no fs: the caller passes `load`, so the same code runs in the
 *   browser client and in a Bun server renderer.
 * - An invalid locale tag throws RangeError (from Intl.Locale). Pass a single
 *   BCP 47 tag: parse an Accept-Language header first and pick one tag from it.
 */

import { formatNumber, pluralCategory } from './intl-format';

/** CLDR plural categories, as `Intl.PluralRules.select()` returns them. */
export type PluralCategory = Intl.LDMLPluralRule;

/** A plural message. `other` is required: every language has it. */
export type PluralMessage = { readonly other: string } & Partial<
	Readonly<Record<Exclude<PluralCategory, 'other'>, string>>
>;

export type Message = string | PluralMessage;

export interface SourceEntry {
	readonly message: Message;
	/** For the translator: where it shows, what each placeholder holds, what stays untranslated. */
	readonly comment: string;
	/** Optional budget in graphemes for fixed-size UI (buttons, HUD labels). */
	readonly maxLength?: number;
}

export type SourceTable = Readonly<Record<string, SourceEntry>>;

export type MessageId<T extends SourceTable> = Extract<keyof T, string>;

/** One locale's translations. Missing IDs fall through to the next locale. */
export type Catalog<Id extends string> = Partial<Readonly<Record<Id, Message>>>;

export type MessageArgs = Readonly<Record<string, string | number>>;

/**
 * Most specific to least specific, then the default locale's own chain.
 * A tag with a region or script also tries its likely script, so zh-TW reaches
 * a zh-Hant catalog and zh-CN a zh-Hans one:
 * zh-TW gives zh-TW, zh-Hant-TW, zh-Hant; zh-Hans-CN gives zh-Hans-CN,
 * zh-CN, zh-Hans, zh; pt-BR gives pt-BR, pt-Latn-BR, pt-Latn, pt. `load`
 * returns null for the tags you do not ship.
 * The bare language is skipped when its likely script differs from the
 * requested one: a bare zh catalog is usually Simplified and a bare sr one
 * Cyrillic, so zh-TW and sr-Latn never fall back to them.
 */
export function fallbackChain(requested: string, defaultLocale: string): string[] {
	const chain: string[] = [];
	const push = (tag: string) => {
		const [canonical] = Intl.getCanonicalLocales(tag);
		if (canonical && !chain.includes(canonical)) chain.push(canonical);
	};
	for (const tag of [requested, defaultLocale]) {
		const loc = new Intl.Locale(tag);
		const { language, region } = loc;
		const script = loc.script ?? (region ? loc.maximize().script : undefined);
		push(loc.toString());
		if (script && region) push(`${language}-${script}-${region}`);
		if (region) push(`${language}-${region}`);
		if (script) push(`${language}-${script}`);
		if (!script || new Intl.Locale(language).maximize().script === script) push(language);
	}
	return chain;
}

export interface Translator<Id extends string> {
	readonly locale: string;
	readonly chain: readonly string[];
	/** IDs the requested locale's own chain lacks; they show fallback or source text. Log these in development. */
	readonly missing: readonly Id[];
	/** Locales whose `load` threw or rejected. They count as absent; report them. */
	readonly loadErrors: ReadonlyArray<{ readonly locale: string; readonly error: unknown }>;
	t(id: Id, args?: MessageArgs): string;
}

/**
 * Loads every catalog in the chain in parallel and resolves every ID at load
 * time. The source table serves as the catalog for `sourceLocale`; `load` is
 * called for the other locales and returns null for a locale you do not ship.
 */
export async function createTranslator<T extends SourceTable>(options: {
	source: T;
	sourceLocale: string;
	requested: string;
	defaultLocale: string;
	load: (locale: string) => Promise<Catalog<MessageId<T>> | null>;
}): Promise<Translator<MessageId<T>>> {
	type Id = MessageId<T>;
	const ids = Object.keys(options.source) as Id[];
	const chain = fallbackChain(options.requested, options.defaultLocale);
	// The requested locale's own chain (pt-BR, pt). Text from outside it is a miss.
	const own = fallbackChain(options.requested, options.requested);
	const [sourceLocale = options.sourceLocale] = Intl.getCanonicalLocales(options.sourceLocale);
	const sourceCatalog: Partial<Record<Id, Message>> = {};
	for (const id of ids) sourceCatalog[id] = options.source[id].message;

	const settled = await Promise.allSettled(
		// The async wrapper turns a load that throws synchronously into a rejection.
		chain.map(async (locale) => (locale === sourceLocale ? sourceCatalog : options.load(locale))),
	);
	const catalogs: Array<{ locale: string; catalog: Catalog<Id> }> = [];
	const loadErrors: Array<{ locale: string; error: unknown }> = [];
	settled.forEach((result, i) => {
		const locale = chain[i] ?? '';
		if (result.status === 'rejected') loadErrors.push({ locale, error: result.reason });
		else if (result.value) catalogs.push({ locale, catalog: result.value });
	});

	const resolved = new Map<Id, { message: Message; locale: string }>();
	const missing: Id[] = [];
	for (const id of ids) {
		const hit = catalogs.find((c) => Object.hasOwn(c.catalog, id));
		const message = hit?.catalog[id];
		if (hit && message !== undefined) {
			resolved.set(id, { message, locale: hit.locale });
			if (!own.includes(hit.locale)) missing.push(id);
		} else {
			resolved.set(id, { message: options.source[id].message, locale: sourceLocale });
			missing.push(id);
		}
	}

	return {
		locale: catalogs[0]?.locale ?? sourceLocale,
		chain,
		missing,
		loadErrors,
		t(id, args = {}) {
			const entry = resolved.get(id);
			if (!entry) return id;
			// Plural rules and number formats follow the locale the text came from,
			// so a fallback to English text does not get Russian plural categories.
			let text: string;
			if (typeof entry.message === 'string') {
				text = entry.message;
			} else {
				const count = Object.hasOwn(args, 'count') ? args.count : undefined;
				if (typeof count !== 'number') throw new Error(`${id}: plural message needs a numeric "count" argument`);
				text = entry.message[pluralCategory(entry.locale, count)] ?? entry.message.other;
			}
			return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
				if (!Object.hasOwn(args, name)) return whole; // visible in QA rather than silently empty
				const value = args[name];
				if (value === undefined) return whole;
				return typeof value === 'number' ? formatNumber(entry.locale, value) : value;
			});
		},
	};
}

/*
Example source table. Keep it in its own file (strings/en.ts) and generate the
translator export (XLIFF, CSV, JSON) from it.

export const en = {
	'hud.gold.label': { message: 'Gold', comment: 'HUD label next to the gold counter.', maxLength: 10 },
	'loot.picked': { message: 'Picked up: {item}', comment: 'Toast. {item} is an item name, already translated. Topic-comment form so the item needs no grammatical agreement.' },
	'inventory.count': { message: { one: '{count} item', other: '{count} items' }, comment: 'Inventory footer. {count} is the number of items.' },
} as const satisfies SourceTable;

const tr = await createTranslator({
	source: en,
	sourceLocale: 'en',
	requested: navigator.language,
	defaultLocale: 'en',
	load: async (locale) => (await fetch(`/strings/${locale}.json`).then((r) => (r.ok ? r.json() : null))) as Catalog<MessageId<typeof en>> | null,
});
tr.t('inventory.count', { count: 3 });
*/
