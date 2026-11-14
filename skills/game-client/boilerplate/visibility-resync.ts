/**
 * Pause the client loop while the tab is hidden and resync on return,
 * instead of simulating the hidden gap.
 *
 * Works with any loop that has start() and stop(), such as ClientGameLoop
 * in game-state-sync: its start() resets the frame timestamp and the
 * accumulator, so the first frame back runs no burst of catch-up ticks.
 *
 * If the page is already hidden when you call watchVisibility (opened in a
 * background tab), the loop is stopped at once and resyncs on first show.
 */

export interface PausableLoop {
	start(): void;
	stop(): void;
}

export interface VisibilityResyncOptions {
	loop: PausableLoop;
	/** Clear held input, suspend audio, show a pause overlay. */
	onHidden?: () => void;
	/**
	 * Bring client state back in line with the server before the loop
	 * restarts: drop the stale interpolation buffer and ask the server for a
	 * full snapshot. Align the tick (ClientGameLoop.syncTick) when the
	 * snapshot carrying the server tick arrives.
	 */
	onVisible?: (hiddenMs: number) => void | Promise<void>;
	/** Called when onVisible throws or rejects; the loop restarts anyway. */
	onError?: (error: unknown) => void;
	signal?: AbortSignal;
}

/** Returns a function that removes the listener. */
export function watchVisibility(options: VisibilityResyncOptions): () => void {
	const controller = new AbortController();
	options.signal?.addEventListener('abort', () => controller.abort(), {
		once: true,
	});
	let hiddenAt: number | null = null;
	let generation = 0;

	const hide = (): void => {
		hiddenAt = performance.now();
		options.loop.stop();
		options.onHidden?.();
	};

	const handle = async (): Promise<void> => {
		const current = ++generation;
		if (document.hidden) {
			if (hiddenAt === null) hide();
			return;
		}
		if (hiddenAt === null) return;
		const hiddenMs = performance.now() - hiddenAt;
		hiddenAt = null;
		try {
			await options.onVisible?.(hiddenMs);
		} catch (error) {
			options.onError?.(error);
		}
		// Disposed, or hidden again, while onVisible was waiting.
		if (controller.signal.aborted) return;
		if (current !== generation || document.hidden) return;
		options.loop.start();
	};

	if (document.hidden) hide();
	document.addEventListener(
		'visibilitychange',
		() => {
			void handle();
		},
		{ signal: controller.signal },
	);
	return () => controller.abort();
}
