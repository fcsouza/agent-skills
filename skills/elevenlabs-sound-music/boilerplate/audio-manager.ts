/**
 * Audio state machine for games.
 * Manages adaptive music, SFX, voice, and ambient layers with crossfade transitions.
 * Plays through HTMLAudioElement. Volumes are set with `element.volume`, which
 * iOS Safari ignores (MDN compat data), so on iOS the crossfade, ducking,
 * sliders and mute have no audible effect.
 */

interface MusicTrack {
	src: string;
	// false for stingers (victory, defeat) that play once.
	loop: boolean;
}

/** S is the game's own union of audio states. All durations are in ms. */
interface AudioConfig<S extends string> {
	music: Partial<Record<S, MusicTrack>>;
	ambient: Partial<Record<S, string>>;
	transitionsMs: Partial<Record<`${S}->${S}`, number>>;
	defaultTransitionMs: number;
	preload: string[];
}

interface AudioManagerState<S extends string> {
	currentState: S | null;
	masterVolume: number;
	musicVolume: number;
	sfxVolume: number;
	voiceVolume: number;
	ambientVolume: number;
	muted: boolean;
	unlocked: boolean;
}

const AUDIO_PREFS_KEY = "game_audio_prefs";

class AudioManager<S extends string> {
	private readonly config: AudioConfig<S>;
	private state: AudioManagerState<S>;
	private musicElement: HTMLAudioElement | null = null;
	private fadingOut: HTMLAudioElement | null = null;
	private fadeTimer: ReturnType<typeof setInterval> | null = null;
	private ambientElement: HTMLAudioElement | null = null;
	private preloadedAudio: Map<string, HTMLAudioElement> = new Map();

	constructor(config: AudioConfig<S>) {
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
	 * Call once at startup. Browsers block playback until the user interacts
	 * with the page; touchend, click and keydown count as user activation,
	 * touchstart does not. On the first such event this plays a silent WAV and,
	 * if that succeeds, starts the music and ambient that were blocked.
	 */
	unlockMobile(): void {
		const events = ["touchend", "click", "keydown"] as const;
		const unlock = () => {
			const audio = new Audio();
			audio.src =
				"data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
			audio
				.play()
				.then(() => {
					audio.pause();
					this.state.unlocked = true;
					for (const event of events) {
						document.removeEventListener(event, unlock);
					}
					this.musicElement?.play().catch(() => {});
					this.ambientElement?.play().catch(() => {});
				})
				.catch(() => {
					// Still locked, retry on next interaction
				});
		};

		for (const event of events) {
			document.addEventListener(event, unlock);
		}
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
	transition(newState: S): void {
		const previousState = this.state.currentState;
		if (previousState === newState) return;

		const duration =
			(previousState === null
				? undefined
				: this.config.transitionsMs[`${previousState}->${newState}`]) ??
			this.config.defaultTransitionMs;

		const musicTrack = this.config.music[newState];
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
			// Duck from the configured level, not the element's current volume,
			// which is still near 0 while a crossfade is fading the track in.
			this.musicElement.volume =
				this.effectiveVolume("music") * (1 - duckMusic);
			audio.addEventListener("ended", () => this.applyVolumes());
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

	getState(): Readonly<AudioManagerState<S>> {
		return { ...this.state };
	}

	private crossfadeMusic(track: MusicTrack, durationMs: number): void {
		// A transition during a running fade: drop the track that was fading out.
		if (this.fadeTimer) {
			clearInterval(this.fadeTimer);
			this.fadeTimer = null;
			this.fadingOut?.pause();
			this.fadingOut = null;
		}

		const targetVolume = this.effectiveVolume("music");
		const oldAudio = this.musicElement;
		const oldStart = oldAudio?.volume ?? 0;

		// Reuse the element preload() created, unless it is still playing.
		const cached = this.preloadedAudio.get(track.src);
		const newAudio =
			cached && cached !== oldAudio ? cached : new Audio(track.src);
		newAudio.currentTime = 0;
		newAudio.loop = track.loop;
		newAudio.volume = 0;
		newAudio.play().catch(() => {});
		this.musicElement = newAudio;
		this.fadingOut = oldAudio;

		const steps = 30;
		let step = 0;

		const finish = () => {
			if (this.fadeTimer) clearInterval(this.fadeTimer);
			this.fadeTimer = null;
			oldAudio?.pause();
			this.fadingOut = null;
			newAudio.volume = targetVolume;
		};

		if (durationMs <= 0) {
			finish();
			return;
		}

		this.fadeTimer = setInterval(() => {
			step++;
			const progress = step / steps;
			if (oldAudio) oldAudio.volume = oldStart * (1 - progress);
			newAudio.volume = targetVolume * progress;
			if (step >= steps) finish();
		}, durationMs / steps);
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
export type { MusicTrack, AudioConfig, AudioManagerState };
