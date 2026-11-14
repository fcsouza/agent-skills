/**
 * Audio configuration for the AudioManager state machine.
 * Genre-agnostic: rename the states and paths for your game. Durations in ms.
 */

// Adjust this path to where you copied audio-manager.ts.
import type { AudioConfig } from "../boilerplate/audio-manager";

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

/**
 * A state with no `music` entry keeps the current track playing (cutscene
 * music is loaded per scene). A state with no `ambient` entry stops ambient.
 */
const AUDIO_CONFIG = {
	music: {
		menu: { src: "/audio/music/menu_theme.ogg", loop: true },
		exploration: { src: "/audio/music/explore.ogg", loop: true },
		combat: { src: "/audio/music/battle.ogg", loop: true },
		boss: { src: "/audio/music/boss.ogg", loop: true },
		social: { src: "/audio/music/social.ogg", loop: true },
		idle: { src: "/audio/music/idle.ogg", loop: true },
		victory: { src: "/audio/stingers/victory.ogg", loop: false },
		defeat: { src: "/audio/stingers/defeat.ogg", loop: false },
	},
	ambient: {
		exploration: "/audio/ambient/world.ogg",
		social: "/audio/ambient/crowd.ogg",
		idle: "/audio/ambient/calm.ogg",
	},
	// Fast into danger, slow out of it.
	transitionsMs: {
		"exploration->combat": 500,
		"combat->exploration": 1500,
		"exploration->boss": 300,
		"boss->victory": 200,
		"boss->defeat": 500,
		"menu->exploration": 1000,
	},
	defaultTransitionMs: 1000,
	// Loaded at game start. Preload combat and boss tracks during exploration.
	preload: [
		"/audio/music/menu_theme.ogg",
		"/audio/stingers/victory.ogg",
		"/audio/stingers/defeat.ogg",
	],
} satisfies AudioConfig<GameAudioState>;

export { AUDIO_CONFIG };
export type { GameAudioState };
