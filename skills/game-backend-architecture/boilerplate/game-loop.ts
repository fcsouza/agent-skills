type TickCallback = (dt: number) => void;

export class GameLoop {
	private tickRate: number;
	private tickDuration: number;
	private accumulator = 0;
	private lastTime = 0;
	private running = false;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private speedMultiplier = 1;
	private onTick: TickCallback;
	private maxAccumulator: number;

	constructor(tickRate: number, onTick: TickCallback) {
		this.tickRate = tickRate;
		this.tickDuration = 1000 / tickRate;
		this.onTick = onTick;
		// Cap at 1 second of accumulated time to prevent spiral of death
		this.maxAccumulator = 1000;
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.lastTime = performance.now();
		this.accumulator = 0;
		this.scheduleNext();
	}

	stop() {
		this.running = false;
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	setSpeed(multiplier: number) {
		this.speedMultiplier = Math.max(0, multiplier);
	}

	getSpeed(): number {
		return this.speedMultiplier;
	}

	getTickRate(): number {
		return this.tickRate;
	}

	isRunning(): boolean {
		return this.running;
	}

	private scheduleNext() {
		if (!this.running) return;

		this.timer = setTimeout(() => {
			this.tick();
			this.scheduleNext();
		}, this.tickDuration);
	}

	private tick() {
		if (!this.running) return;

		const currentTime = performance.now();
		const deltaTime = (currentTime - this.lastTime) * this.speedMultiplier;
		this.lastTime = currentTime;

		// Overflow protection: cap accumulated time
		this.accumulator += Math.min(deltaTime, this.maxAccumulator);

		while (this.accumulator >= this.tickDuration) {
			// dt in seconds for game logic
			this.onTick(this.tickDuration / 1000);
			this.accumulator -= this.tickDuration;
		}
	}
}
