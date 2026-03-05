// ============================================================
// Weighted Loot Table — Vose's Alias Method for O(1) Rolls
// ============================================================

// ============================================================
// Types
// ============================================================

export interface LootConstraints {
	minRarity?: number;
	maxRarity?: number;
	tags?: string[];
}

interface LootEntry<T> {
	item: T;
	weight: number;
	constraints?: LootConstraints;
}

// ============================================================
// Seeded PRNG — mulberry32
// ============================================================

const mulberry32 = (seed: number): (() => number) => {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

// ============================================================
// Alias Table (Vose's Algorithm)
// ============================================================

interface AliasTable {
	prob: number[];
	alias: number[];
}

const buildAliasTable = (weights: number[]): AliasTable => {
	const n = weights.length;
	const totalWeight = weights.reduce((sum, w) => sum + w, 0);

	const prob = new Array<number>(n);
	const alias = new Array<number>(n).fill(0);
	const scaled = weights.map((w) => (w * n) / totalWeight);

	const small: number[] = [];
	const large: number[] = [];

	for (let i = 0; i < n; i++) {
		if (scaled[i] < 1) small.push(i);
		else large.push(i);
	}

	while (small.length > 0 && large.length > 0) {
		const s = small.pop()!;
		const l = large.pop()!;

		prob[s] = scaled[s];
		alias[s] = l;
		scaled[l] = scaled[l] + scaled[s] - 1;

		if (scaled[l] < 1) small.push(l);
		else large.push(l);
	}

	while (large.length > 0) prob[large.pop()!] = 1;
	while (small.length > 0) prob[small.pop()!] = 1;

	return { prob, alias };
};

// ============================================================
// LootTable Class
// ============================================================

export class LootTable<T> {
	private entries: LootEntry<T>[] = [];
	private guaranteed: T[] = [];
	private aliasTable: AliasTable | null = null;

	add(item: T, weight: number, constraints?: LootConstraints): LootTable<T> {
		if (weight <= 0) {
			throw new Error("Weight must be positive");
		}
		this.entries.push({ item, weight, constraints });
		this.aliasTable = null;
		return this;
	}

	withGuaranteed(item: T): LootTable<T> {
		this.guaranteed.push(item);
		return this;
	}

	roll(count = 1, rng?: () => number): T[] {
		if (this.entries.length === 0) return [...this.guaranteed];

		const random = rng ?? Math.random;
		const table = this.getAliasTable();
		const n = this.entries.length;
		const results: T[] = [...this.guaranteed];

		for (let i = 0; i < count; i++) {
			const col = Math.floor(random() * n);
			const coinToss = random();
			const idx = coinToss < table.prob[col] ? col : table.alias[col];
			results.push(this.entries[idx].item);
		}

		return results;
	}

	rollUnique(count: number, rng?: () => number): T[] {
		if (this.entries.length === 0) return [...this.guaranteed];

		const random = rng ?? Math.random;
		const available = [...this.entries];
		const results: T[] = [...this.guaranteed];
		const maxUnique = Math.min(count, available.length);

		for (let i = 0; i < maxUnique; i++) {
			const weights = available.map((e) => e.weight);
			const totalWeight = weights.reduce((sum, w) => sum + w, 0);

			let roll = random() * totalWeight;
			let chosenIdx = 0;

			for (let j = 0; j < available.length; j++) {
				roll -= available[j].weight;
				if (roll <= 0) {
					chosenIdx = j;
					break;
				}
			}

			results.push(available[chosenIdx].item);
			available.splice(chosenIdx, 1);
		}

		return results;
	}

	getEntries(): ReadonlyArray<Readonly<LootEntry<T>>> {
		return this.entries;
	}

	getTotalWeight(): number {
		return this.entries.reduce((sum, e) => sum + e.weight, 0);
	}

	getProbabilities(): Array<{ item: T; probability: number }> {
		const total = this.getTotalWeight();
		return this.entries.map((e) => ({
			item: e.item,
			probability: e.weight / total,
		}));
	}

	private getAliasTable(): AliasTable {
		if (!this.aliasTable) {
			this.aliasTable = buildAliasTable(this.entries.map((e) => e.weight));
		}
		return this.aliasTable;
	}
}

// ============================================================
// Factory Helpers
// ============================================================

export const createSeededRng = (seed: number): (() => number) => {
	return mulberry32(seed);
};

export const createLootTable = <T>(): LootTable<T> => {
	return new LootTable<T>();
};
