# Audio Pipeline — Browser Games

Complete pipeline from Lyria WAV output to in-game playback with dynamic music switching.

## WAV to Web Formats

### Single File Conversion

```bash
# WAV to OGG (best for web, smaller file size)
ffmpeg -i input.wav -c:a libvorbis -q:a 5 output.ogg

# WAV to MP3 (broader compatibility)
ffmpeg -i input.wav -c:a libmp3lame -q:a 2 output.mp3

# WAV to both formats
ffmpeg -i input.wav -c:a libvorbis -q:a 5 output.ogg -c:a libmp3lame -q:a 2 output.mp3
```

### Batch Conversion

```bash
# Convert all WAV files to OGG
for f in *.wav; do ffmpeg -i "$f" -c:a libvorbis -q:a 5 "${f%.wav}.ogg"; done

# Convert all WAV files to MP3
for f in *.wav; do ffmpeg -i "$f" -c:a libmp3lame -q:a 2 "${f%.wav}.mp3"; done
```

### Trim Stingers

Victory/defeat stingers only need ~10 seconds. Trim the 32.8s output:

```bash
# Keep first 10 seconds
ffmpeg -i victory_full.wav -t 10 -c:a libvorbis -q:a 5 victory.ogg

# Extract from 2s to 12s (skip intro silence)
ffmpeg -i victory_full.wav -ss 2 -t 10 -c:a libvorbis -q:a 5 victory.ogg
```

## Seamless Loop Creation

### ffmpeg Crossfade

```bash
# Crossfade last 2s with first 2s
ffmpeg -i track.ogg -filter_complex "acrossfade=d=2:c1=tri:c2=tri" looped.ogg
```

### Stitching Multiple Clips

```bash
# Stitch two clips with a 3-second crossfade
ffmpeg -i clip1.ogg -i clip2.ogg -filter_complex "[0][1]acrossfade=d=3:c1=tri:c2=tri" long_track.ogg
```

### Web Audio API Crossfade

For runtime crossfading in the browser:

```typescript
const crossfadeLoop = (
  audioContext: AudioContext,
  buffer: AudioBuffer,
  crossfadeDuration = 2,
): AudioBufferSourceNode => {
  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();

  source.buffer = buffer;
  source.loop = true;
  source.loopEnd = buffer.duration;
  source.loopStart = crossfadeDuration;

  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  source.start();
  return source;
};
```

### Finding Natural Loop Points

Analyze the waveform for similar start/end amplitudes:

1. Load the WAV in an audio editor (Audacity, etc.)
2. Look for zero-crossing points near the start and end
3. Trim to those points for the smoothest loop
4. Export and convert to OGG

## Next.js Audio Integration

### Zustand Audio Store

```typescript
import { create } from 'zustand';

interface AudioState {
  currentTrack: string | null;
  volume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  muted: boolean;
  audioElement: HTMLAudioElement | null;
  ambientElement: HTMLAudioElement | null;
  play: (track: string) => void;
  pause: () => void;
  resume: () => void;
  setVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  toggleMute: () => void;
  crossfadeTo: (track: string, duration?: number) => void;
  playAmbient: (track: string) => void;
  stopAmbient: () => void;
  playSfx: (track: string) => void;
}

const useAudio = create<AudioState>((set, get) => ({
  currentTrack: null,
  volume: 0.7,
  musicVolume: 0.6,
  sfxVolume: 0.7,
  ambientVolume: 0.35,
  muted: false,
  audioElement: null,
  ambientElement: null,

  play: (track) => {
    const { audioElement, musicVolume, volume, muted } = get();

    if (audioElement) {
      audioElement.pause();
    }

    const audio = new Audio(track);
    audio.volume = muted ? 0 : musicVolume * volume;
    audio.loop = true;
    audio.play();

    set({ audioElement: audio, currentTrack: track });
  },

  pause: () => {
    get().audioElement?.pause();
  },

  resume: () => {
    get().audioElement?.play();
  },

  setVolume: (volume) => {
    const { audioElement, musicVolume, muted } = get();
    if (audioElement && !muted) {
      audioElement.volume = musicVolume * volume;
    }
    set({ volume });
  },

  setMusicVolume: (musicVolume) => {
    const { audioElement, volume, muted } = get();
    if (audioElement && !muted) {
      audioElement.volume = musicVolume * volume;
    }
    set({ musicVolume });
  },

  setSfxVolume: (sfxVolume) => {
    set({ sfxVolume });
  },

  setAmbientVolume: (ambientVolume) => {
    const { ambientElement, volume, muted } = get();
    if (ambientElement && !muted) {
      ambientElement.volume = ambientVolume * volume;
    }
    set({ ambientVolume });
  },

  toggleMute: () => {
    const { muted, audioElement, ambientElement, musicVolume, ambientVolume, volume } = get();
    const newMuted = !muted;

    if (audioElement) {
      audioElement.volume = newMuted ? 0 : musicVolume * volume;
    }
    if (ambientElement) {
      ambientElement.volume = newMuted ? 0 : ambientVolume * volume;
    }

    set({ muted: newMuted });
  },

  crossfadeTo: (track, duration = 1.5) => {
    const { audioElement, musicVolume, volume, muted } = get();
    const targetVolume = muted ? 0 : musicVolume * volume;

    const newAudio = new Audio(track);
    newAudio.volume = 0;
    newAudio.loop = true;
    newAudio.play();

    const steps = 30;
    const stepDuration = (duration * 1000) / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;

      if (audioElement) {
        audioElement.volume = targetVolume * (1 - progress);
      }
      newAudio.volume = targetVolume * progress;

      if (step >= steps) {
        clearInterval(interval);
        audioElement?.pause();
        set({ audioElement: newAudio, currentTrack: track });
      }
    }, stepDuration);
  },

  playAmbient: (track) => {
    const { ambientElement, ambientVolume, volume, muted } = get();

    if (ambientElement) {
      ambientElement.pause();
    }

    const audio = new Audio(track);
    audio.volume = muted ? 0 : ambientVolume * volume;
    audio.loop = true;
    audio.play();

    set({ ambientElement: audio });
  },

  stopAmbient: () => {
    const { ambientElement } = get();
    if (ambientElement) {
      ambientElement.pause();
      set({ ambientElement: null });
    }
  },

  playSfx: (track) => {
    const { sfxVolume, volume, muted } = get();
    const audio = new Audio(track);
    audio.volume = muted ? 0 : sfxVolume * volume;
    audio.play();
  },
}));

export { useAudio };
```

### Preloading Audio

```typescript
const preloadAudio = (sources: string[]): void => {
  for (const src of sources) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
  }
};

// Preload on scene transition
preloadAudio([
  '/audio/music/battle_standard.ogg',
  '/audio/stingers/victory.ogg',
  '/audio/stingers/defeat.ogg',
]);
```

## Dynamic Music System

### Game State to Music Mapping

```typescript
type GameState = 'menu' | 'exploration' | 'combat' | 'boss' | 'town' | 'idle' | 'victory' | 'defeat';

const MUSIC_MAP: Record<GameState, string> = {
  menu: '/audio/music/menu_theme.ogg',
  exploration: '/audio/music/explore_calm.ogg',
  combat: '/audio/music/battle_intense.ogg',
  boss: '/audio/music/boss_epic.ogg',
  town: '/audio/music/town_peaceful.ogg',
  idle: '/audio/music/ambient_minimal.ogg',
  victory: '/audio/stingers/victory.ogg',
  defeat: '/audio/stingers/defeat.ogg',
};

const AMBIENT_MAP: Partial<Record<GameState, string>> = {
  exploration: '/audio/ambient/forest_wind.ogg',
  town: undefined,
  combat: undefined,
};
```

### Subscribing to Game State Changes

```typescript
import { useGameStore } from './game-store';

// Subscribe outside of React for immediate response
useGameStore.subscribe(
  (state) => state.gameState,
  (gameState) => {
    const { crossfadeTo, playAmbient, stopAmbient } = useAudio.getState();

    const musicTrack = MUSIC_MAP[gameState];
    if (musicTrack) {
      crossfadeTo(musicTrack);
    }

    const ambientTrack = AMBIENT_MAP[gameState];
    if (ambientTrack) {
      playAmbient(ambientTrack);
    } else {
      stopAmbient();
    }
  },
);
```

### Combat Music Handling

```typescript
const enterCombat = (isBoss: boolean): void => {
  const { crossfadeTo } = useAudio.getState();
  const track = isBoss ? MUSIC_MAP.boss : MUSIC_MAP.combat;
  crossfadeTo(track, 0.5); // Fast crossfade for combat
};

const exitCombat = (victory: boolean): void => {
  const { crossfadeTo, playSfx } = useAudio.getState();

  // Play stinger
  playSfx(victory ? MUSIC_MAP.victory : MUSIC_MAP.defeat);

  // After stinger, fade back to exploration
  setTimeout(() => {
    crossfadeTo(MUSIC_MAP.exploration, 2);
  }, 3000);
};
```

## Mobile Audio Restrictions

iOS and Android require user interaction before audio can play.

### Detecting Audio Lock

```typescript
const isAudioLocked = async (): Promise<boolean> => {
  const audio = new Audio();
  audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  try {
    await audio.play();
    audio.pause();
    return false;
  } catch {
    return true;
  }
};
```

### Unlocking Audio on First Interaction

```typescript
const unlockAudio = (): void => {
  const unlock = () => {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audio.play().then(() => {
      audio.pause();
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    }).catch(() => {
      // Still locked, will retry on next interaction
    });
  };

  document.addEventListener('touchstart', unlock, { once: false });
  document.addEventListener('click', unlock, { once: false });
};
```

### Splash Screen Pattern

```tsx
const AudioGate = ({ children }: { children: React.ReactNode }) => {
  const [unlocked, setUnlocked] = useState(false);

  const handleStart = () => {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audio.play().then(() => {
      audio.pause();
      setUnlocked(true);
    });
  };

  if (!unlocked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <button
          onClick={handleStart}
          className="rounded-lg bg-primary px-8 py-4 text-lg font-bold text-primary-foreground"
        >
          Tap to Start
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
```

### Persisting User Preferences

```typescript
const AUDIO_PREFS_KEY = 'game_audio_prefs';

interface AudioPrefs {
  muted: boolean;
  volume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
}

const loadAudioPrefs = (): Partial<AudioPrefs> => {
  try {
    const stored = localStorage.getItem(AUDIO_PREFS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveAudioPrefs = (prefs: AudioPrefs): void => {
  localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
};

// Subscribe to audio store changes and persist
useAudio.subscribe(
  (state) => ({
    muted: state.muted,
    volume: state.volume,
    musicVolume: state.musicVolume,
    sfxVolume: state.sfxVolume,
    ambientVolume: state.ambientVolume,
  }),
  (prefs) => saveAudioPrefs(prefs),
);
```

## Audio File Organization

```
public/audio/
├── music/
│   ├── menu_theme.ogg
│   ├── explore_forest.ogg
│   ├── explore_dungeon.ogg
│   ├── battle_standard.ogg
│   ├── boss_main.ogg
│   ├── town_market.ogg
│   └── town_tavern.ogg
├── ambient/
│   ├── dungeon_drips.ogg
│   ├── forest_wind.ogg
│   └── city_bustle.ogg
└── stingers/
    ├── victory.ogg
    ├── defeat.ogg
    └── levelup.ogg
```

## Volume Mixing Guide

| Category | Base Volume | Purpose |
|----------|-------------|---------|
| Music | 0.5–0.7 | Main background track |
| Ambient | 0.3–0.4 | Sits under music, adds depth |
| Stingers | 0.8–1.0 | Momentarily important events |
| SFX | 0.6–0.8 | Gameplay feedback |

User master volume slider multiplies all categories. Provide separate sliders for music, SFX, and ambient in game settings.
