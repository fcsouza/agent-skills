/**
 * Keep a canvas's drawing buffer at the element's size in device pixels,
 * for plain Canvas 2D, WebGL or three.js. Phaser and PixiJS size their own
 * canvas; do not use this with them.
 *
 * Contract: onResize(width, height) receives the new buffer size in device
 * pixels, already written to canvas.width and canvas.height. It must not
 * change the canvas's CSS size, or the observer fires again. With three.js:
 *
 *   renderer.setPixelRatio(1);           // sizes below are device pixels
 *   fitCanvasToDisplay(canvas, (w, h) => {
 *     renderer.setSize(w, h, false);     // false: leave the CSS size alone
 *     camera.aspect = w / h;
 *     camera.updateProjectionMatrix();
 *   });
 *
 * Give the canvas a CSS size (for example width: 100%; height: 100%, or a
 * sized parent). Without one, its displayed size follows the buffer size
 * set here, and the buffer grows on every resize callback.
 *
 * Uses ResizeObserver's devicePixelContentBoxSize where the browser gives
 * it (exact device pixels, no rounding moire) and falls back to CSS size
 * times devicePixelRatio. A devicePixelRatio change (zoom, a move to
 * another monitor) is caught with a matchMedia resolution query.
 */

export interface FitCanvasOptions {
	/** Cap on the device-pixel ratio. 2 is this skill's rule for 3x phone screens. */
	maxPixelRatio?: number;
	/** Optional cap on the longer buffer side, in device pixels. Unset by default. */
	maxSize?: number;
}

export interface BufferSizeInput {
	cssWidth: number;
	cssHeight: number;
	/** devicePixelContentBoxSize, when the browser reports it. */
	deviceWidth?: number;
	deviceHeight?: number;
	devicePixelRatio: number;
	maxPixelRatio: number;
	maxSize?: number;
}

/** Pure size computation, exported for tests. */
export function bufferSize(input: BufferSizeInput): {
	width: number;
	height: number;
} {
	const ratio = Math.min(input.devicePixelRatio, input.maxPixelRatio);
	let width: number;
	let height: number;
	if (input.deviceWidth !== undefined && input.deviceHeight !== undefined) {
		const scale = ratio / input.devicePixelRatio;
		width = input.deviceWidth * scale;
		height = input.deviceHeight * scale;
	} else {
		width = input.cssWidth * ratio;
		height = input.cssHeight * ratio;
	}
	if (input.maxSize !== undefined) {
		const longest = Math.max(width, height);
		if (longest > input.maxSize) {
			const shrink = input.maxSize / longest;
			width *= shrink;
			height *= shrink;
		}
	}
	return {
		width: Math.max(1, Math.round(width)),
		height: Math.max(1, Math.round(height)),
	};
}

export function fitCanvasToDisplay(
	canvas: HTMLCanvasElement,
	onResize: (width: number, height: number) => void,
	{ maxPixelRatio = 2, maxSize }: FitCanvasOptions = {},
): () => void {
	const controller = new AbortController();
	let last: Omit<
		BufferSizeInput,
		'devicePixelRatio' | 'maxPixelRatio' | 'maxSize'
	> = { cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight };

	const apply = (): void => {
		const { width, height } = bufferSize({
			...last,
			devicePixelRatio: window.devicePixelRatio,
			maxPixelRatio,
			maxSize,
		});
		if (canvas.width === width && canvas.height === height) return;
		canvas.width = width;
		canvas.height = height;
		onResize(width, height);
	};

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const css = entry.contentBoxSize[0];
			const device = entry.devicePixelContentBoxSize?.[0];
			last = {
				cssWidth: css?.inlineSize ?? canvas.clientWidth,
				cssHeight: css?.blockSize ?? canvas.clientHeight,
				deviceWidth: device?.inlineSize,
				deviceHeight: device?.blockSize,
			};
			apply();
		}
	});
	try {
		observer.observe(canvas, { box: 'device-pixel-content-box' });
	} catch {
		// Browsers without device-pixel-content-box reject the option.
		observer.observe(canvas, { box: 'content-box' });
	}

	// The query matches only the current ratio, so re-arm it after each change.
	const watchRatio = (): void => {
		if (controller.signal.aborted) return;
		matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
			'change',
			() => {
				// Device sizes from the observer are stale until it fires again.
				last = {
					cssWidth: canvas.clientWidth,
					cssHeight: canvas.clientHeight,
				};
				apply();
				watchRatio();
			},
			{ once: true, signal: controller.signal },
		);
	};
	watchRatio();

	return () => {
		controller.abort();
		observer.disconnect();
	};
}
