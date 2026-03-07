// ============================================================
// BSP Dungeon Generator — Deterministic, Seed-Based
// ============================================================

// ============================================================
// Types
// ============================================================

export interface Point {
	x: number;
	y: number;
}

export interface Room {
	id: number;
	x: number;
	y: number;
	width: number;
	height: number;
	center: Point;
}

export interface Corridor {
	from: Point;
	to: Point;
	waypoint: Point;
}

export type CellType = "wall" | "floor" | "corridor" | "entrance" | "exit";

export interface Cell {
	type: CellType;
	roomId: number | null;
}

export interface DungeonOptions {
	width: number;
	height: number;
	minRooms: number;
	maxRooms: number;
	minRoomSize: number;
	maxRoomSize: number;
	corridorWidth: number;
}

export interface DungeonMap {
	rooms: Room[];
	corridors: Corridor[];
	entrance: Point;
	exits: Point[];
	grid: Cell[][];
	seed: string;
	options: DungeonOptions;
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

const hashSeed = (seed: string): number => {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) {
		hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
	}
	return hash >>> 0;
};

// ============================================================
// RNG Helpers
// ============================================================

const randInt = (rng: () => number, min: number, max: number): number => {
	return Math.floor(rng() * (max - min + 1)) + min;
};

// ============================================================
// BSP Tree
// ============================================================

interface BSPNode {
	x: number;
	y: number;
	width: number;
	height: number;
	left: BSPNode | null;
	right: BSPNode | null;
	room: Room | null;
}

const createNode = (
	x: number,
	y: number,
	width: number,
	height: number,
): BSPNode => ({
	x,
	y,
	width,
	height,
	left: null,
	right: null,
	room: null,
});

const splitNode = (
	node: BSPNode,
	rng: () => number,
	minSize: number,
): boolean => {
	if (node.left || node.right) return false;

	const canSplitH = node.height >= minSize * 2 + 2;
	const canSplitV = node.width >= minSize * 2 + 2;

	if (!canSplitH && !canSplitV) return false;

	let splitHorizontally: boolean;
	if (canSplitH && canSplitV) {
		splitHorizontally = rng() > 0.5;
	} else {
		splitHorizontally = canSplitH;
	}

	if (splitHorizontally) {
		const splitAt = randInt(rng, minSize + 1, node.height - minSize - 1);
		node.left = createNode(node.x, node.y, node.width, splitAt);
		node.right = createNode(
			node.x,
			node.y + splitAt,
			node.width,
			node.height - splitAt,
		);
	} else {
		const splitAt = randInt(rng, minSize + 1, node.width - minSize - 1);
		node.left = createNode(node.x, node.y, splitAt, node.height);
		node.right = createNode(
			node.x + splitAt,
			node.y,
			node.width - splitAt,
			node.height,
		);
	}

	return true;
};

const getLeaves = (node: BSPNode): BSPNode[] => {
	if (!node.left && !node.right) return [node];
	const leaves: BSPNode[] = [];
	if (node.left) leaves.push(...getLeaves(node.left));
	if (node.right) leaves.push(...getLeaves(node.right));
	return leaves;
};

// ============================================================
// Room Placement
// ============================================================

const placeRoom = (
	node: BSPNode,
	rng: () => number,
	roomId: number,
	minSize: number,
	maxSize: number,
): Room | null => {
	const maxW = Math.min(maxSize, node.width - 2);
	const maxH = Math.min(maxSize, node.height - 2);
	if (maxW < minSize || maxH < minSize) return null;

	const w = randInt(rng, minSize, maxW);
	const h = randInt(rng, minSize, maxH);
	const x = node.x + randInt(rng, 1, node.width - w - 1);
	const y = node.y + randInt(rng, 1, node.height - h - 1);

	const room: Room = {
		id: roomId,
		x,
		y,
		width: w,
		height: h,
		center: {
			x: Math.floor(x + w / 2),
			y: Math.floor(y + h / 2),
		},
	};

	node.room = room;
	return room;
};

// ============================================================
// Corridor Creation
// ============================================================

const connectRooms = (a: Room, b: Room, rng: () => number): Corridor => {
	const from = a.center;
	const to = b.center;

	const waypoint: Point =
		rng() > 0.5 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };

	return { from, to, waypoint };
};

// ============================================================
// Grid Rendering
// ============================================================

const createGrid = (width: number, height: number): Cell[][] => {
	return Array.from({ length: height }, () =>
		Array.from({ length: width }, (): Cell => ({ type: "wall", roomId: null })),
	);
};

const carveRoom = (grid: Cell[][], room: Room): void => {
	for (let y = room.y; y < room.y + room.height; y++) {
		for (let x = room.x; x < room.x + room.width; x++) {
			if (grid[y]?.[x]) {
				grid[y][x] = { type: "floor", roomId: room.id };
			}
		}
	}
};

const carveCorridor = (
	grid: Cell[][],
	corridor: Corridor,
	width: number,
): void => {
	const carvePoint = (px: number, py: number) => {
		const half = Math.floor(width / 2);
		for (let dy = -half; dy <= half; dy++) {
			for (let dx = -half; dx <= half; dx++) {
				const cell = grid[py + dy]?.[px + dx];
				if (cell && cell.type === "wall") {
					grid[py + dy][px + dx] = { type: "corridor", roomId: null };
				}
			}
		}
	};

	const carveLine = (from: Point, to: Point) => {
		const dx = Math.sign(to.x - from.x);
		const dy = Math.sign(to.y - from.y);
		let { x, y } = from;

		while (x !== to.x || y !== to.y) {
			carvePoint(x, y);
			if (x !== to.x) x += dx;
			else if (y !== to.y) y += dy;
		}
		carvePoint(to.x, to.y);
	};

	carveLine(corridor.from, corridor.waypoint);
	carveLine(corridor.waypoint, corridor.to);
};

// ============================================================
// Reachability Validation
// ============================================================

const allRoomsReachable = (grid: Cell[][], rooms: Room[]): boolean => {
	if (rooms.length === 0) return false;

	const height = grid.length;
	const width = grid[0].length;
	const visited = Array.from({ length: height }, () =>
		new Array<boolean>(width).fill(false),
	);

	const start = rooms[0].center;
	const queue: Point[] = [start];
	visited[start.y][start.x] = true;

	while (queue.length > 0) {
		const { x, y } = queue.shift()!;
		for (const [dx, dy] of [
			[0, 1],
			[0, -1],
			[1, 0],
			[-1, 0],
		]) {
			const nx = x + dx;
			const ny = y + dy;
			if (
				nx >= 0 &&
				nx < width &&
				ny >= 0 &&
				ny < height &&
				!visited[ny][nx] &&
				grid[ny][nx].type !== "wall"
			) {
				visited[ny][nx] = true;
				queue.push({ x: nx, y: ny });
			}
		}
	}

	return rooms.every((room) => visited[room.center.y][room.center.x]);
};

// ============================================================
// Dungeon Generator
// ============================================================

const DEFAULT_OPTIONS: DungeonOptions = {
	width: 80,
	height: 60,
	minRooms: 5,
	maxRooms: 12,
	minRoomSize: 4,
	maxRoomSize: 10,
	corridorWidth: 1,
};

const MAX_GENERATION_ATTEMPTS = 20;

export class DungeonGenerator {
	generate(seed: string, options?: Partial<DungeonOptions>): DungeonMap {
		const opts = { ...DEFAULT_OPTIONS, ...options };

		for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
			const numericSeed = hashSeed(seed) + attempt;
			const rng = mulberry32(numericSeed);
			const result = this.tryGenerate(seed, opts, rng);
			if (result) return result;
		}

		throw new Error(
			`Failed to generate valid dungeon after ${MAX_GENERATION_ATTEMPTS} attempts. Loosen budget constraints (minRooms: ${opts.minRooms}, maxRooms: ${opts.maxRooms}).`,
		);
	}

	private tryGenerate(
		seed: string,
		opts: DungeonOptions,
		rng: () => number,
	): DungeonMap | null {
		const root = createNode(0, 0, opts.width, opts.height);

		// BSP split — depth depends on desired room count
		const targetDepth = Math.ceil(Math.log2(opts.maxRooms)) + 1;
		const splitQueue: BSPNode[] = [root];

		for (let depth = 0; depth < targetDepth; depth++) {
			const current = [...splitQueue];
			splitQueue.length = 0;
			for (const node of current) {
				if (splitNode(node, rng, opts.minRoomSize)) {
					if (node.left) splitQueue.push(node.left);
					if (node.right) splitQueue.push(node.right);
				} else {
					splitQueue.push(node);
				}
			}
		}

		// Place rooms in leaf nodes
		const leaves = getLeaves(root);
		const rooms: Room[] = [];
		let roomId = 0;

		for (const leaf of leaves) {
			if (rooms.length >= opts.maxRooms) break;
			const room = placeRoom(
				leaf,
				rng,
				roomId,
				opts.minRoomSize,
				opts.maxRoomSize,
			);
			if (room) {
				rooms.push(room);
				roomId++;
			}
		}

		if (rooms.length < opts.minRooms) return null;

		// Connect adjacent rooms
		const corridors: Corridor[] = [];
		for (let i = 0; i < rooms.length - 1; i++) {
			corridors.push(connectRooms(rooms[i], rooms[i + 1], rng));
		}

		// Build grid
		const grid = createGrid(opts.width, opts.height);
		for (const room of rooms) carveRoom(grid, room);
		for (const corridor of corridors) {
			carveCorridor(grid, corridor, opts.corridorWidth);
		}

		// Validate reachability
		if (!allRoomsReachable(grid, rooms)) return null;

		// Place entrance and exits
		const entrance = rooms[0].center;
		const exits = [rooms[rooms.length - 1].center];

		grid[entrance.y][entrance.x] = { type: "entrance", roomId: rooms[0].id };
		grid[exits[0].y][exits[0].x] = {
			type: "exit",
			roomId: rooms[rooms.length - 1].id,
		};

		return { rooms, corridors, entrance, exits, grid, seed, options: opts };
	}
}
