/**
 * Resume a suspended AudioContext on the first user gesture.
 *
 * An AudioContext created before a gesture starts suspended. Only some
 * events count as a gesture: keydown, mousedown, pointerup from touch or
 * pen, touchend. A touch pointerdown does not, so listen for pointerup.
 *
 * Resolves once the context runs. Rejects, and removes its listeners, when
 * the context is closed or the signal aborts.
 */
export interface UnlockAudioOptions {
	target?: EventTarget;
	signal?: AbortSignal;
}

export function unlockAudioOnGesture(
	context: AudioContext,
	{ target = window, signal }: UnlockAudioOptions = {},
): Promise<void> {
	if (context.state === 'running') return Promise.resolve();
	if (context.state === 'closed') {
		return Promise.reject(new Error('AudioContext is closed'));
	}
	if (signal?.aborted) return Promise.reject(signal.reason);
	return new Promise((resolve, reject) => {
		const controller = new AbortController();
		const fail = (reason: unknown): void => {
			controller.abort();
			reject(reason);
		};
		signal?.addEventListener('abort', () => fail(signal.reason), {
			signal: controller.signal,
		});
		const tryResume = (): void => {
			context.resume().then(
				() => {
					if (context.state !== 'running') return;
					controller.abort();
					resolve();
				},
				(error: unknown) => {
					// A closed context never resumes; otherwise wait for the next gesture.
					if (context.state === 'closed') fail(error);
				},
			);
		};
		for (const type of ['pointerup', 'keydown', 'touchend', 'mousedown']) {
			target.addEventListener(type, tryResume, { signal: controller.signal });
		}
	});
}
