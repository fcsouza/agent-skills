---
name: elevenlabs-sound-music
version: 1.0.0
description: >-
  SFX generation, adaptive music, voice acting, and audio state machine
  integration. Covers BOTH ElevenLabs API AND Vertex AI Lyria as
  user-choosable alternatives for game audio production.
---

# ElevenLabs Sound & Music

## Purpose

SFX generation, adaptive music, voice acting, and audio state machine integration for games. Covers **both** the ElevenLabs API (voice lines, SFX) **and** Vertex AI Lyria (music generation) as user-choosable alternatives. One skill, two providers, one unified audio pipeline.

## When to Use

**Trigger keywords**: sound effects, SFX, music generation, voice acting, adaptive music, audio, ElevenLabs, Lyria, game audio, soundtrack, ambient sound, voice lines, text-to-speech, voice cloning, game music, audio state machine.

Use this skill when:
- Generating sound effects or voice lines via ElevenLabs
- Generating music tracks via Vertex AI Lyria
- Building an adaptive music system that responds to game state
- Setting up an audio state machine with crossfade transitions
- Implementing mobile audio unlock patterns
- Designing a layered audio mix (music + SFX + ambient + voice)

## Prerequisites

None. Provider-specific setup is covered in each client boilerplate.

**ElevenLabs** requires an API key (`ELEVENLABS_API_KEY`).
**Vertex AI Lyria** requires a Google Cloud project with Vertex AI API enabled and authentication (ADC or service account).

## Core Principles

> *"Silence is as powerful as sound. Restraint in audio design creates moments of profound impact."* -- Fumito Ueda (ICO, Shadow of the Colossus)

> *"Music should mirror the emotional arc. The soundtrack IS the emotional journey."* -- Jenova Chen (Journey)

1. **Audio is 50% of the experience** -- never an afterthought. Budget audio design time equal to visual design time.
2. **Adaptive music**: the soundtrack responds to game state (combat, exploration, menu). Never play a static playlist.
3. **Layered audio**: ambient + music + SFX + voice = immersive soundscape. Mix layers independently.
4. **Two providers, one interface**: ElevenLabs for voice/SFX, Lyria for music -- or mix them. The game code should not care which provider generated the audio file.
5. **Preload critical audio, lazy-load ambient**: menu music and combat stingers load first. Forest ambience can wait.
6. **Respect mobile audio restrictions**: iOS and Android require user interaction before playback. Gate audio behind a "Tap to Start" interaction.
7. **Audio state machine**: define states and transitions, not individual play commands. The system decides what to play based on current state.

## Step-by-Step

### 1. Choose your providers

| Need | Provider | Why |
|------|----------|-----|
| Character voice lines | ElevenLabs TTS | Natural speech, voice cloning for consistency |
| Sound effects | ElevenLabs SFX | Text-described SFX generation |
| Background music | Vertex AI Lyria | 32.8s instrumental WAV, prompt-driven |
| Ambient loops | Either | Lyria for musical ambience, ElevenLabs for environmental SFX |

### 2. Set up API clients

- Copy `boilerplate/elevenlabs-client.ts` for voice and SFX generation
- Copy `boilerplate/lyria-client.ts` for music generation
- Configure environment variables for your chosen provider(s)

### 3. Define your audio states

Use `templates/sound-config.ts` as a starting point. Define every game state that needs distinct audio (menu, exploration, combat, boss, social, idle). Map each state to track paths, volume levels, and crossfade durations.

### 4. Implement the audio manager

Copy `boilerplate/audio-manager.ts` into your project. This provides:
- State-based music switching with crossfade
- Independent volume layers (music, SFX, voice, ambient)
- Mobile audio unlock
- Preload manifest support

### 5. Generate your audio assets

Use the prompt templates from `templates/prompt-catalog.md`:
- **ElevenLabs**: voice lines, UI sounds, combat SFX
- **Lyria**: menu theme, exploration music, combat tracks, boss themes

### 6. Convert and organize

Lyria outputs WAV (32.8s, 48 kHz stereo). Convert for web:

```bash
# WAV to OGG (primary web format)
ffmpeg -i input.wav -c:a libvorbis -q:a 5 output.ogg

# WAV to MP3 (fallback)
ffmpeg -i input.wav -c:a libmp3lame -q:a 2 output.mp3
```

ElevenLabs outputs MP3 or OGG directly -- no conversion needed.

### 7. Integrate with game state

Subscribe your audio manager to game state changes. When the game enters combat, the audio manager crossfades to the combat track. When combat ends, it plays the victory stinger then fades back to exploration.

## Code Examples

### ElevenLabs: Generate a voice line

```typescript
import { ElevenLabsClient } from './elevenlabs-client';

const client = new ElevenLabsClient(process.env.ELEVENLABS_API_KEY!);

// Generate NPC dialogue
const audioBuffer = await client.textToSpeech(
  'Welcome, traveler. The road ahead is dangerous.',
  { voiceId: 'your-voice-id', model: 'eleven_multilingual_v2' },
);
await Bun.write('public/audio/voice/npc_greeting.mp3', audioBuffer);
```

### ElevenLabs: Generate a sound effect

```typescript
const sfxBuffer = await client.generateSfx(
  'sword clash, metallic impact, brief reverb',
  { duration: 2 },
);
await Bun.write('public/audio/sfx/sword_clash.mp3', sfxBuffer);
```

### Lyria: Generate a combat track

```typescript
import { LyriaClient } from './lyria-client';

const lyria = new LyriaClient({
  projectId: process.env.GCP_PROJECT_ID!,
  location: 'us-central1',
});

const tracks = await lyria.generate({
  prompt: 'Intense battle music, driving and urgent, 150 BPM, electric guitar riffs, pounding drums, brass stabs',
  negativePrompt: 'no vocals, no calm sections, no silence, no sound effects',
  seed: 2001,
  sampleCount: 2,
});

await lyria.saveAll(tracks, 'combat_standard', './output/music/combat');
```

### Audio state machine usage

```typescript
import { AudioManager } from './audio-manager';
import { AUDIO_CONFIG } from './sound-config';

const audio = new AudioManager(AUDIO_CONFIG);
audio.unlockMobile();

// Game state changes drive audio automatically
audio.transition('menu');        // Plays menu theme
audio.transition('exploration'); // Crossfades to exploration + ambient
audio.transition('combat');      // Fast crossfade to combat music
audio.transition('boss');        // Switches to boss theme
audio.playSfx('sword_clash');    // One-shot SFX on top
audio.playVoice('npc_greeting'); // Voice line on top
```

## Cross-References

- **game-backend-architecture**: Server-side audio asset management, CDN delivery
- **game-design-fundamentals**: Feedback loops -- audio reinforces player actions and emotional beats

## Pitfalls

1. **Playing audio without user interaction on mobile** -- iOS/Android will silently fail. Always gate behind a tap/click.
2. **No crossfade between states** -- Hard cuts between combat and exploration music break immersion. Always crossfade.
3. **Single volume slider** -- Players need separate music, SFX, voice, and ambient controls. Provide per-layer sliders.
4. **Generating music without negative prompts** -- Lyria may add vocals or sound effects. Always include `no vocals, no sound effects`.
5. **Not preloading combat audio** -- If combat starts and the track is still loading, the player hears silence. Preload combat tracks during exploration.
6. **Ignoring audio file size** -- OGG is smaller than MP3 at similar quality. Use OGG primary, MP3 fallback. Compress aggressively for ambient loops.
7. **Hardcoding track paths** -- Use a config mapping (state to path). Swapping tracks during iteration becomes trivial.
8. **Not saving Lyria seeds** -- Without the seed, you cannot reproduce or refine a track. Always log seeds in a manifest.

## Designer Philosophy

**Fumito Ueda** (ICO, Shadow of the Colossus): Silence is as powerful as sound. Restraint in audio design creates moments of profound impact. When the music drops out during a key moment, the silence itself becomes the emotional beat. Do not fill every second with audio.

**Jenova Chen** (Journey): Music should mirror the emotional arc. The soundtrack IS the emotional journey. In Journey, the music builds with the player's progress, peaks at moments of connection, and recedes during solitude. Your adaptive music system should do the same -- the audio state machine is the tool that makes this possible.

## Sources

- [ElevenLabs API Documentation](https://elevenlabs.io/docs)
- [ElevenLabs Sound Effects API](https://elevenlabs.io/docs/api-reference/sound-generation)
- [Vertex AI Lyria Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria)
- [GDC Vault -- Game Audio Talks](https://www.gdcvault.com/)
- [Web Audio API -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
