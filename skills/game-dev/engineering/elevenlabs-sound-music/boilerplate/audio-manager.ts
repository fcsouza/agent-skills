/**
 * Audio state machine for games.
 * Manages adaptive music, SFX, voice, and ambient layers with crossfade transitions.
 */

type GameAudioState =
	| "menu"
	| "exploration"
	| "combat"
	| "boss"
	| "social"
	| "idle";

interface AudioLayer {
	music: number;
	sfx: number;
	voice: number;
	ambient: number;
}

interface TransitionConfig {
	duration: number;
}

interface AudioConfig {
	tracks: Record<GameAudioState, string>;
	ambient: Partial<Record<GameAudioState, string>>;
	volumes: Record<GameAudioState, AudioLayer>;
	transitions: Partial<
		Record<`${GameAudioState}->${GameAudioState}`, TransitionConfig>
	>;
	defaultTransitionDuration: number;
	preload: string[];
}

interface AudioManagerState {
	currentState: GameAudioState | null;
	masterVolume: number;
	musicVolume: number;
	sfxVolume: number;
	voiceVolume: number;
	ambientVolume: number;
	muted: boolean;
	unlocked: boolean;
}

const AUDIO_PREFS_KEY = "game_audio_prefs";

class AudioManager {
	private readonly config: AudioConfig;
	private state: AudioManagerState;
	private musicElement: HTMLAudioElement | null = null;
	private ambientElement: HTMLAudioElement | null = null;
	private preloadedAudio: Map<string, HTMLAudioElement> = new Map();

	constructor(config: AudioConfig) {
		this.config = config;
		this.state = {
			currentState: null,
			masterVolume: 0.7,
			musicVolume: 0.6,
			sfxVolume: 0.7,
			voiceVolume: 0.8,
			ambientVolume: 0.35,
			muted: false,
			unlocked: false,
		};

		this.loadPrefs();
	}

	/**
	 * Unlock audio on mobile devices. Call on first user interaction (tap/click).
	 * Plays a silent WAV to satisfy iOS/Android autoplay restrictions.
	 */
	unlockMobile(): void {
		const unlock = () => {
			const audio = new Audio();
			audio.src =
				"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
			audio
				.play()
				.then(() => {
					audio.pause();
					this.state.unlocked = true;
					document.removeEventListener("touchstart", unlock);
					document.removeEventListener("click", unlock);
				})
				.catch(() => {
					// Still locked, retry on next interaction
				});
		};

		document.addEventListener("touchstart", unlock, { once: false });
		document.addEventListener("click", unlock, { once: false });
	}

	/**
	 * Preload audio files from the config manifest.
	 * Call during initial load or scene transitions.
	 */
	preload(sources?: string[]): void {
		const toPreload = sources ?? this.config.preload;

		for (const src of toPreload) {
			if (this.preloadedAudio.has(src)) continue;

			const audio = new Audio(src);
			audio.preload = "auto";
			audio.load();
			this.preloadedAudio.set(src, audio);
		}
	}

	/**
	 * Transition to a new game audio state.
	 * Crossfades music and switches ambient based on config.
	 */
	transition(newState: GameAudioState): void {
		const previousState = this.state.currentState;
		if (previousState === newState) return;

		const transitionKey = previousState
			? (`${previousState}->${newState}` as const)
			: null;

		const duration =
			transitionKey && this.config.transitions[transitionKey]
				? this.config.transitions[transitionKey]!.duration
				: this.config.defaultTransitionDuration;

		const musicTrack = this.config.tracks[newState];
		if (musicTrack) {
			this.crossfadeMusic(musicTrack, duration);
		}

		const ambientTrack = this.config.ambient[newState];
		if (ambientTrack) {
			this.playAmbient(ambientTrack);
		} else {
			this.stopAmbient();
		}

		this.state.currentState = newState;
		this.savePrefs();
	}

	/**
	 * Play a one-shot sound effect. Does not loop.
	 */
	playSfx(src: string): void {
		const audio = new Audio(src);
		audio.volume = this.effectiveVolume("sfx");
		audio.play().catch(() => {});
	}

	/**
	 * Play a voice line. Does not loop. Ducks music volume briefly.
	 */
	playVoice(src: string, duckMusic = 0.3): void {
		const audio = new Audio(src);
		audio.volume = this.effectiveVolume("voice");

		if (this.musicElement && duckMusic > 0) {
			const originalVolume = this.musicElement.volume;
			this.musicElement.volume = originalVolume * (1 - duckMusic);

			audio.addEventListener("ended", () => {
				if (this.musicElement) {
					this.musicElement.volume = originalVolume;
				}
			});
		}

		audio.play().catch(() => {});
	}

	setMasterVolume(volume: number): void {
		this.state.masterVolume = Math.max(0, Math.min(1, volume));
		this.applyVolumes();
		this.savePrefs();
	}

	setMusicVolume(volume: number): void {
		this.state.musicVolume = Math.max(0, Math.min(1, volume));
		this.applyVolumes();
		this.savePrefs();
	}

	setSfxVolume(volume: number): void {
		this.state.sfxVolume = Math.max(0, Math.min(1, volume));
		this.savePrefs();
	}

	setVoiceVolume(volume: number): void {
		this.state.voiceVolume = Math.max(0, Math.min(1, volume));
		this.savePrefs();
	}

	setAmbientVolume(volume: number): void {
		this.state.ambientVolume = Math.max(0, Math.min(1, volume));
		this.applyVolumes();
		this.savePrefs();
	}

	toggleMute(): void {
		this.state.muted = !this.state.muted;
		this.applyVolumes();
		this.savePrefs();
	}

	getState(): Readonly<AudioManagerState> {
		return { ...this.state };
	}

	private crossfadeMusic(src: string, duration: number): void {
		const targetVolume = this.effectiveVolume("music");

		const newAudio = new Audio(src);
		newAudio.volume = 0;
		newAudio.loop = true;
		newAudio.play().catch(() => {});

		const oldAudio = this.musicElement;
		const steps = 30;
		const stepDuration = (duration * 1000) / steps;
		let step = 0;

		const interval = setInterval(() => {
			step++;
			const progress = step / steps;

			if (oldAudio) {
				oldAudio.volume = targetVolume * (1 - progress);
			}
			newAudio.volume = targetVolume * progress;

			if (step >= steps) {
				clearInterval(interval);
				oldAudio?.pause();
				this.musicElement = newAudio;
			}
		}, stepDuration);
	}

	private playAmbient(src: string): void {
		this.stopAmbient();

		const audio = new Audio(src);
		audio.volume = this.effectiveVolume("ambient");
		audio.loop = true;
		audio.play().catch(() => {});

		this.ambientElement = audio;
	}

	private stopAmbient(): void {
		if (this.ambientElement) {
			this.ambientElement.pause();
			this.ambientElement = null;
		}
	}

	private effectiveVolume(
		layer: "music" | "sfx" | "voice" | "ambient",
	): number {
		if (this.state.muted) return 0;

		const layerVolumes: Record<string, number> = {
			music: this.state.musicVolume,
			sfx: this.state.sfxVolume,
			voice: this.state.voiceVolume,
			ambient: this.state.ambientVolume,
		};

		return layerVolumes[layer] * this.state.masterVolume;
	}

	private applyVolumes(): void {
		if (this.musicElement) {
			this.musicElement.volume = this.effectiveVolume("music");
		}
		if (this.ambientElement) {
			this.ambientElement.volume = this.effectiveVolume("ambient");
		}
	}

	private loadPrefs(): void {
		try {
			const stored = localStorage.getItem(AUDIO_PREFS_KEY);
			if (!stored) return;

			const prefs = JSON.parse(stored);
			this.state.masterVolume = prefs.masterVolume ?? this.state.masterVolume;
			this.state.musicVolume = prefs.musicVolume ?? this.state.musicVolume;
			this.state.sfxVolume = prefs.sfxVolume ?? this.state.sfxVolume;
			this.state.voiceVolume = prefs.voiceVolume ?? this.state.voiceVolume;
			this.state.ambientVolume =
				prefs.ambientVolume ?? this.state.ambientVolume;
			this.state.muted = prefs.muted ?? this.state.muted;
		} catch {
			// localStorage unavailable (SSR, privacy mode)
		}
	}

	private savePrefs(): void {
		try {
			localStorage.setItem(
				AUDIO_PREFS_KEY,
				JSON.stringify({
					masterVolume: this.state.masterVolume,
					musicVolume: this.state.musicVolume,
					sfxVolume: this.state.sfxVolume,
					voiceVolume: this.state.voiceVolume,
					ambientVolume: this.state.ambientVolume,
					muted: this.state.muted,
				}),
			);
		} catch {
			// localStorage unavailable
		}
	}
}

export { AudioManager };
export type {
	GameAudioState,
	AudioLayer,
	TransitionConfig,
	AudioConfig,
	AudioManagerState,
};
