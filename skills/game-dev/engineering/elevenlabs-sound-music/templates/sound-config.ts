/**
 * Audio configuration for game state machine.
 * Genre-agnostic — define states and tracks for any game type.
 */

type GameAudioState =
	| "menu"
	| "exploration"
	| "combat"
	| "boss"
	| "social"
	| "idle"
	| "cutscene"
	| "victory"
	| "defeat"
	| "loading";

interface AudioTrackConfig {
	path: string;
	loop: boolean;
	baseVolume: number; // 0-1
	fadeInMs: number;
	fadeOutMs: number;
}

interface AudioStateConfig {
	music: AudioTrackConfig | null;
	ambient: AudioTrackConfig | null;
	sfxVolume: number; // master SFX volume for this state
	voiceVolume: number; // master voice volume for this state
}

/**
 * State → track mapping.
 * Override per game — this is a template with sensible defaults.
 */
const AUDIO_STATE_MAP: Record<GameAudioState, AudioStateConfig> = {
	menu: {
		music: {
			path: "/audio/music/menu_theme.ogg",
			loop: true,
			baseVolume: 0.6,
			fadeInMs: 1000,
			fadeOutMs: 500,
		},
		ambient: null,
		sfxVolume: 0.8,
		voiceVolume: 1.0,
	},
	exploration: {
		music: {
			path: "/audio/music/explore.ogg",
			loop: true,
			baseVolume: 0.5,
			fadeInMs: 2000,
			fadeOutMs: 1000,
		},
		ambient: {
			path: "/audio/ambient/world.ogg",
			loop: true,
			baseVolume: 0.3,
			fadeInMs: 3000,
			fadeOutMs: 1500,
		},
		sfxVolume: 0.7,
		voiceVolume: 1.0,
	},
	combat: {
		music: {
			path: "/audio/music/battle.ogg",
			loop: true,
			baseVolume: 0.7,
			fadeInMs: 500,
			fadeOutMs: 500,
		},
		ambient: null,
		sfxVolume: 0.9,
		voiceVolume: 0.8,
	},
	boss: {
		music: {
			path: "/audio/music/boss.ogg",
			loop: true,
			baseVolume: 0.8,
			fadeInMs: 300,
			fadeOutMs: 300,
		},
		ambient: null,
		sfxVolume: 1.0,
		voiceVolume: 0.7,
	},
	social: {
		music: {
			path: "/audio/music/social.ogg",
			loop: true,
			baseVolume: 0.4,
			fadeInMs: 1500,
			fadeOutMs: 1000,
		},
		ambient: {
			path: "/audio/ambient/crowd.ogg",
			loop: true,
			baseVolume: 0.2,
			fadeInMs: 2000,
			fadeOutMs: 1000,
		},
		sfxVolume: 0.6,
		voiceVolume: 1.0,
	},
	idle: {
		music: {
			path: "/audio/music/idle.ogg",
			loop: true,
			baseVolume: 0.3,
			fadeInMs: 3000,
			fadeOutMs: 2000,
		},
		ambient: {
			path: "/audio/ambient/calm.ogg",
			loop: true,
			baseVolume: 0.2,
			fadeInMs: 3000,
			fadeOutMs: 2000,
		},
		sfxVolume: 0.5,
		voiceVolume: 0.8,
	},
	cutscene: {
		music: null, // cutscene-specific music loaded per scene
		ambient: null,
		sfxVolume: 0.8,
		voiceVolume: 1.0,
	},
	victory: {
		music: {
			path: "/audio/stingers/victory.ogg",
			loop: false,
			baseVolume: 0.9,
			fadeInMs: 0,
			fadeOutMs: 500,
		},
		ambient: null,
		sfxVolume: 0.8,
		voiceVolume: 1.0,
	},
	defeat: {
		music: {
			path: "/audio/stingers/defeat.ogg",
			loop: false,
			baseVolume: 0.7,
			fadeInMs: 0,
			fadeOutMs: 1000,
		},
		ambient: null,
		sfxVolume: 0.5,
		voiceVolume: 1.0,
	},
	loading: {
		music: null,
		ambient: null,
		sfxVolume: 0.3,
		voiceVolume: 0.0,
	},
};

/**
 * Crossfade durations between states (ms).
 * Key format: "fromState->toState"
 */
const CROSSFADE_DURATIONS: Record<string, number> = {
	"exploration->combat": 500,
	"combat->exploration": 1500,
	"exploration->boss": 300,
	"boss->victory": 200,
	"boss->defeat": 500,
	"menu->exploration": 1000,
	default: 1000,
};

function getCrossfadeDuration(
	from: GameAudioState,
	to: GameAudioState,
): number {
	return (
		CROSSFADE_DURATIONS[`${from}->${to}`] ?? CROSSFADE_DURATIONS.default ?? 1000
	);
}

/**
 * Preload manifest — tracks to load immediately on game start.
 */
const PRELOAD_MANIFEST: string[] = [
	"/audio/music/menu_theme.ogg",
	"/audio/stingers/victory.ogg",
	"/audio/stingers/defeat.ogg",
];

export {
	AUDIO_STATE_MAP,
	CROSSFADE_DURATIONS,
	PRELOAD_MANIFEST,
	getCrossfadeDuration,
};
export type { GameAudioState, AudioTrackConfig, AudioStateConfig };
