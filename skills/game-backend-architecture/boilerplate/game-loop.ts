type TickCallback = (dt: number) => void;
type ErrorCallback = (error: unknown) => void;

// Fixed-timestep loop after Glenn Fiedler, "Fix Your Timestep!": real time
// fills an accumulator and the simulation drains it in equal dt steps.
export class GameLoop {
	private readonly tickDuration: number;
	private readonly onTick: TickCallback;
	private readonly onError: ErrorCallback;
	// Longest real-time gap fed into one pass. Fiedler's example clamps the
	// frame time at 0.25 s; longer stalls are dropped instead of replayed,
	// which stops the spiral of death (more catch-up steps, falling further behind).
	private readonly maxFrameTime = 250;
	private accumulator = 0;
	private lastTime = 0;
	private running = false;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private speedMultiplier = 1;

	// A throw from onTick stops this loop and goes to onError; it never
	// reaches the event loop, so other loops keep running.
	constructor(
		private readonly tickRate: number,
		onTick: TickCallback,
		onError: ErrorCallback = (error) => console.error("game loop stopped", error),
	) {
		this.tickDuration = 1000 / tickRate;
		this.onTick = onTick;
		this.onError = onError;
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
		// Clamp real elapsed time first, then scale it for fast-forward.
		const frameTime =
			Math.min(currentTime - this.lastTime, this.maxFrameTime) *
			this.speedMultiplier;
		this.lastTime = currentTime;
		this.accumulator += frameTime;

		// Recheck `running`: onTick or onError may stop the loop mid-pass.
		while (this.running && this.accumulator >= this.tickDuration) {
			try {
				// Game logic always sees the same dt, in seconds.
				this.onTick(this.tickDuration / 1000);
			} catch (error) {
				this.stop();
				this.onError(error);
				return;
			}
			this.accumulator -= this.tickDuration;
		}
	}
}
