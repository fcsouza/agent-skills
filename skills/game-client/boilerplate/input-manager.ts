/**
 * Stack-neutral input sampler for a browser game: held keys by
 * KeyboardEvent.code, pointers (mouse, pen, touch) by pointerId, and
 * gamepads polled from navigator.getGamepads().
 *
 * Call sample() from ClientGameLoop.captureInput (once per tick). Key
 * presses and releases, and pointer downs and ups, accumulate between calls,
 * so a key tap or click shorter than one tick is still seen once.
 *
 * Keys are read on window, so held keys keep working whatever has focus,
 * except keys typed into an input, textarea, select or contenteditable
 * element (a chat box), which are ignored. Browser defaults for the codes
 * in blockDefaults (arrows and Space scroll the page) are blocked only while
 * the canvas itself has focus: attach() gives it tabindex 0 and focuses it
 * on pointerdown, so buttons and the page keep their keys otherwise.
 */

export interface PointerSample {
	id: number;
	type: string;
	primary: boolean;
	/** CSS pixels relative to the canvas's top-left corner. */
	x: number;
	y: number;
	buttons: number;
}

export interface GamepadSample {
	index: number;
	/** True when the browser maps the device to the standard layout. */
	standard: boolean;
	pressed: boolean[];
	justPressed: boolean[];
	values: number[];
	/** Axes in -1..1 with the dead zone applied. */
	axes: number[];
}

export interface InputSnapshot {
	held: ReadonlySet<string>;
	justPressed: ReadonlySet<string>;
	justReleased: ReadonlySet<string>;
	pointers: ReadonlyMap<number, PointerSample>;
	/** Pointers that went down since the last sample, at their down position. */
	pointerDowns: readonly PointerSample[];
	/** Pointers that went up or were cancelled since the last sample. */
	pointerUps: readonly PointerSample[];
	/** Distance in CSS pixels between the first two touch pointers, or null. */
	pinchDistance: number | null;
	gamepads: GamepadSample[];
}

export interface InputManagerOptions {
	/** Axis values with an absolute value below this read as 0. The 0.15 default is this skill's rule; tune per controller. */
	deadzone: number;
	/** Codes whose browser default (scrolling) is blocked while the canvas has focus. */
	blockDefaults: readonly string[];
}

const DEFAULTS: InputManagerOptions = {
	deadzone: 0.15,
	blockDefaults: [
		'ArrowUp',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'Space',
	],
};

export class InputManager {
	private readonly options: InputManagerOptions;
	private controller: AbortController | null = null;
	private readonly held = new Set<string>();
	private justPressed = new Set<string>();
	private justReleased = new Set<string>();
	private readonly pointers = new Map<number, PointerSample>();
	private pointerDowns: PointerSample[] = [];
	private pointerUps: PointerSample[] = [];
	private readonly lastPadButtons = new Map<number, boolean[]>();

	constructor(
		private readonly canvas: HTMLCanvasElement,
		options: Partial<InputManagerOptions> = {},
	) {
		this.options = { ...DEFAULTS, ...options };
	}

	/** Add every listener. detach() removes them all through one AbortSignal. */
	attach(): void {
		if (this.controller) return;
		this.controller = new AbortController();
		const signal = this.controller.signal;

		// Stop the browser from panning or zooming the canvas on touch.
		this.canvas.style.touchAction = 'none';
		// Make the canvas focusable so key defaults can be scoped to it.
		if (this.canvas.tabIndex < 0) this.canvas.tabIndex = 0;

		window.addEventListener(
			'keydown',
			(event) => {
				if (isEditable(event.target)) return;
				if (
					document.activeElement === this.canvas &&
					this.options.blockDefaults.includes(event.code)
				) {
					event.preventDefault();
				}
				if (event.repeat) return; // OS auto-repeat is not a new press
				if (!this.held.has(event.code)) this.justPressed.add(event.code);
				this.held.add(event.code);
			},
			{ signal },
		);
		window.addEventListener(
			'keyup',
			(event) => {
				this.held.delete(event.code);
				this.justReleased.add(event.code);
			},
			{ signal },
		);
		// A key released while the window has no focus never sends keyup.
		window.addEventListener('blur', () => this.clear(), { signal });

		const toSample = (event: PointerEvent): PointerSample => {
			const rect = this.canvas.getBoundingClientRect();
			return {
				id: event.pointerId,
				type: event.pointerType,
				primary: event.isPrimary,
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
				buttons: event.buttons,
			};
		};
		const onPointer = (event: PointerEvent): void => {
			this.pointers.set(event.pointerId, toSample(event));
		};
		const endPointer = (event: PointerEvent): void => {
			this.pointers.delete(event.pointerId);
			this.pointerUps.push(toSample(event));
		};
		this.canvas.addEventListener(
			'pointerdown',
			(event) => {
				// Keep receiving moves and the pointerup when the drag leaves the canvas.
				this.canvas.setPointerCapture(event.pointerId);
				this.canvas.focus();
				onPointer(event);
				this.pointerDowns.push(toSample(event));
			},
			{ signal },
		);
		this.canvas.addEventListener('pointermove', onPointer, { signal });
		this.canvas.addEventListener('pointerup', endPointer, { signal });
		this.canvas.addEventListener('pointercancel', endPointer, { signal });
		// A hovering mouse (no button held, so no capture) that leaves the canvas.
		this.canvas.addEventListener(
			'pointerleave',
			(event) => {
				if (event.buttons === 0) this.pointers.delete(event.pointerId);
			},
			{ signal },
		);
		window.addEventListener(
			'gamepaddisconnected',
			(event) => this.lastPadButtons.delete(event.gamepad.index),
			{ signal },
		);
		this.canvas.addEventListener(
			'contextmenu',
			(event) => event.preventDefault(),
			{ signal },
		);
	}

	detach(): void {
		this.controller?.abort();
		this.controller = null;
		this.clear();
	}

	/**
	 * Release held keys and pointers. Call on blur and when the tab is hidden.
	 * Each one shows up once in justReleased or pointerUps, so drags end.
	 */
	clear(): void {
		for (const code of this.held) this.justReleased.add(code);
		this.held.clear();
		for (const pointer of this.pointers.values()) this.pointerUps.push(pointer);
		this.pointers.clear();
	}

	sample(): InputSnapshot {
		const snapshot: InputSnapshot = {
			held: new Set(this.held),
			justPressed: this.justPressed,
			justReleased: this.justReleased,
			pointers: new Map(this.pointers),
			pointerDowns: this.pointerDowns,
			pointerUps: this.pointerUps,
			pinchDistance: this.pinchDistance(),
			gamepads: this.pollGamepads(),
		};
		this.justPressed = new Set();
		this.justReleased = new Set();
		this.pointerDowns = [];
		this.pointerUps = [];
		return snapshot;
	}

	private pinchDistance(): number | null {
		const touches = [...this.pointers.values()].filter(
			(p) => p.type === 'touch',
		);
		const [a, b] = touches;
		if (!a || !b) return null;
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	private pollGamepads(): GamepadSample[] {
		const samples: GamepadSample[] = [];
		const seen = new Set<number>();
		// Re-read the list every sample: a Gamepad object kept from an earlier
		// call does not update in every browser.
		for (const pad of navigator.getGamepads()) {
			if (!pad?.connected) continue;
			seen.add(pad.index);
			const pressed = pad.buttons.map((button) => button.pressed);
			const last = this.lastPadButtons.get(pad.index) ?? [];
			this.lastPadButtons.set(pad.index, pressed);
			samples.push({
				index: pad.index,
				standard: pad.mapping === 'standard',
				pressed,
				justPressed: pressed.map((down, i) => down && !last[i]),
				values: pad.buttons.map((button) => button.value),
				axes: pad.axes.map((value) =>
					Math.abs(value) < this.options.deadzone ? 0 : value,
				),
			});
		}
		for (const index of this.lastPadButtons.keys()) {
			if (!seen.has(index)) this.lastPadButtons.delete(index);
		}
		return samples;
	}
}

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}
