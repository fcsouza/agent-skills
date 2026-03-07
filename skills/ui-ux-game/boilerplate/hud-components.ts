// ============================================================
// HUD Component Interfaces — Genre-Agnostic, Framework-Independent
// ============================================================

// ============================================================
// Base HUD Element
// ============================================================

export interface HUDPosition {
	/** Anchor point on screen */
	anchor:
		| "top-left"
		| "top-center"
		| "top-right"
		| "center-left"
		| "center"
		| "center-right"
		| "bottom-left"
		| "bottom-center"
		| "bottom-right";
	/** Offset from anchor in pixels */
	offsetX: number;
	offsetY: number;
}

export interface HUDElement {
	id: string;
	/** Whether the element is currently visible */
	visible: boolean;
	/** Position on screen */
	position: HUDPosition;
	/** Layer order (higher = on top) */
	zIndex: number;
	/** Opacity (0-1) */
	opacity: number;
	/** Whether the element responds to input */
	interactive: boolean;
}

// ============================================================
// Health Bar
// ============================================================

export interface HealthBarSegment {
	/** Label for this segment (e.g., "health", "shield", "armor") */
	label: string;
	current: number;
	max: number;
	/** Color as hex string */
	color: string;
}

export interface HealthBar extends HUDElement {
	segments: HealthBarSegment[];
	/** Show numeric values alongside the bar */
	showNumeric: boolean;
	/** Animate changes with a trailing "damage" indicator */
	showDamageTrail: boolean;
	/** Duration of the damage trail animation in ms */
	damageTrailDurationMs: number;
	/** Orientation of the bar */
	orientation: "horizontal" | "vertical";
	/** Width and height in pixels */
	width: number;
	height: number;
}

// ============================================================
// Resource Display (mana, stamina, energy, ammo, etc.)
// ============================================================

export interface ResourceDisplay extends HUDElement {
	/** Resource identifier */
	resourceId: string;
	/** Display label */
	label: string;
	current: number;
	max: number;
	/** Display mode */
	displayMode: "bar" | "numeric" | "icon-stack" | "radial";
	/** Color as hex string */
	color: string;
	/** Whether to show regeneration rate */
	showRegenRate: boolean;
	/** Regeneration per second (for display) */
	regenPerSecond: number;
	/** Flash when resource is low */
	lowThreshold: number;
	/** Icon identifier for icon-stack mode */
	iconId: string | null;
}

// ============================================================
// Notification Queue
// ============================================================

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface Notification {
	id: string;
	message: string;
	priority: NotificationPriority;
	/** Duration in ms before auto-dismiss, 0 = manual dismiss */
	durationMs: number;
	/** Optional icon identifier */
	iconId: string | null;
	/** Timestamp when the notification was created */
	createdAt: number;
}

export interface NotificationQueue extends HUDElement {
	/** Currently visible notifications */
	notifications: Notification[];
	/** Maximum number of visible notifications at once */
	maxVisible: number;
	/** Where new notifications appear relative to existing ones */
	stackDirection: "up" | "down";
	/** Animation style for enter/exit */
	animation: "slide" | "fade" | "pop" | "none";
	/** Duration of enter/exit animation in ms */
	animationDurationMs: number;
	/** Group duplicate notifications and show count */
	groupDuplicates: boolean;
}

// ============================================================
// Minimap
// ============================================================

export interface MinimapMarker {
	id: string;
	/** Marker type for icon resolution */
	type: string;
	/** World-space position */
	worldX: number;
	worldY: number;
	/** Color override (null = use default for type) */
	color: string | null;
	/** Whether this marker is visible on the minimap */
	visible: boolean;
	/** Tooltip text on hover */
	label: string | null;
}

export interface MinimapConfig extends HUDElement {
	/** Shape of the minimap viewport */
	shape: "circle" | "square" | "rectangle";
	/** Size in pixels (width for rectangle, diameter for circle) */
	size: number;
	/** Aspect ratio for rectangle shape */
	aspectRatio: number;
	/** Zoom level (1.0 = default) */
	zoom: number;
	/** Whether the minimap rotates with the player */
	rotateWithPlayer: boolean;
	/** Currently tracked markers */
	markers: MinimapMarker[];
	/** Show player's field of view cone */
	showFOV: boolean;
	/** Background color/transparency */
	backgroundColor: string;
	/** Border color */
	borderColor: string;
}

// ============================================================
// Tooltip
// ============================================================

export interface TooltipSection {
	/** Section label (e.g., "Stats", "Description", "Lore") */
	label: string | null;
	/** Content lines */
	lines: Array<{ text: string; color: string | null }>;
}

export interface TooltipConfig extends HUDElement {
	/** Maximum width in pixels */
	maxWidth: number;
	/** Delay before showing in ms */
	showDelayMs: number;
	/** Sections to display */
	sections: TooltipSection[];
	/** Follow cursor or anchor to element */
	followCursor: boolean;
	/** Padding inside the tooltip in pixels */
	padding: number;
	/** Background color */
	backgroundColor: string;
	/** Border color */
	borderColor: string;
	/** Text color */
	textColor: string;
}

// ============================================================
// Crosshair / Reticle
// ============================================================

export interface CrosshairConfig extends HUDElement {
	/** Crosshair style */
	style: "dot" | "cross" | "circle" | "custom";
	/** Size in pixels */
	size: number;
	/** Color as hex string */
	color: string;
	/** Gap in center (pixels) */
	centerGap: number;
	/** Line thickness (pixels) */
	thickness: number;
	/** Whether crosshair expands based on accuracy/spread */
	dynamic: boolean;
	/** Custom image identifier for custom style */
	customImageId: string | null;
}

// ============================================================
// Action Bar / Hotbar
// ============================================================

export interface ActionBarSlot {
	index: number;
	/** Bound action/item identifier, null if empty */
	actionId: string | null;
	/** Cooldown remaining in seconds, 0 = ready */
	cooldownRemaining: number;
	/** Total cooldown duration for progress display */
	cooldownTotal: number;
	/** Keybind label (e.g., "1", "Q", "F1") */
	keybind: string;
	/** Whether the slot is currently usable */
	enabled: boolean;
}

export interface ActionBarConfig extends HUDElement {
	slots: ActionBarSlot[];
	/** Orientation of the bar */
	orientation: "horizontal" | "vertical";
	/** Size of each slot in pixels */
	slotSize: number;
	/** Gap between slots in pixels */
	gap: number;
	/** Show keybind labels */
	showKeybinds: boolean;
	/** Show cooldown overlay */
	showCooldowns: boolean;
}
