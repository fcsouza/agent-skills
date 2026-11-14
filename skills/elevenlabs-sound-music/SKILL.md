---
name: elevenlabs-sound-music
description: >-
  Covers generating game audio with ElevenLabs (voice lines, sound effects,
  music) and Google Lyria 2 (instrumental music clips), and playing it in the
  browser through an audio state machine with crossfades, per-layer volume and
  an unlock on the first user input. Use when a game needs sound effects, NPC
  voice lines or a soundtrack, when music must follow game state (menu,
  exploration, combat, boss) without hard cuts, when audio stays silent on a
  phone until the player taps, or when choosing between ElevenLabs and Lyria
  for music.
---

# Game Audio with ElevenLabs and Lyria

Generate audio assets offline with the vendor SDKs, then play them through one state machine that the game drives.

Related skills: `game-design-fundamentals` (audio as player feedback).

## Choose the provider

| Asset | Use | Model id (set explicitly) |
|---|---|---|
| Pre-recorded dialogue | ElevenLabs Text to Speech | `eleven_multilingual_v2` |
| Lines generated while the player waits | ElevenLabs Text to Speech | `eleven_flash_v2_5` (about 100 ms median latency) |
| Sound effects, ambient loops | ElevenLabs Sound Effects, 0.5 to 30 s, `loop: true` for seamless ambience | `eleven_text_to_sound_v3` |
| Music of any length (3 s to 10 min), optional vocals, section control through a composition plan | ElevenLabs Music (paid plans only) | `music_v2_5` |
| Instrumental clips of about 30 s, up to 4 variations per prompt, billed to Google Cloud | Vertex AI Lyria 2 | `lyria-002` |

Lyria 3 is in preview on Vertex AI: `lyria-3-pro-preview` (up to 184 s, vocals, MP3) and `lyria-3-clip-preview` (30 s). It uses the `interactions` endpoint, not the predict call in `boilerplate/lyria-client.ts`. See https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-3.

ElevenLabs lists `eleven_v4` under the Text to Dialogue API, which this skill does not cover.

### Deprecated models

From https://elevenlabs.io/docs/overview/models#deprecated-models:

- `eleven_text_to_sound_v2` is removed on 2027-03-01. It is still the Sound Effects default when `model_id` is unset.
- `music_v1` is removed on 2027-01-31. It is still the Music default when `model_id` is unset.
- `eleven_turbo_v2_5` and `eleven_turbo_v2` are deprecated in favour of the Flash models (no removal date given).

## Procedure

1. List the game's audio states and copy `templates/sound-config.ts`. Map each state to a music track, an optional ambient loop, and a crossfade time per transition.
2. Write prompts from `templates/prompt-catalog.md`. Answer genre, mood, instruments, tempo and era in each music prompt.
3. Generate the assets in a build script or on a server, never in the game client. The API keys stay out of the bundle.
4. Save one manifest entry per accepted file: provider, model id, prompt, length, plan or seed. Without it you cannot regenerate a track.
5. Lyria returns WAV. Convert it to a compressed format before shipping.
6. In the client, create the `AudioManager`, call `unlockMobile()` at startup, call `transition()` on every game-state change, and `preload()` the tracks the next state is likely to need.

## Files

- Copy when generating voice, sound effects or music with ElevenLabs: `boilerplate/elevenlabs-audio.ts`.
- Copy when generating instrumental clips with Lyria 2: `boilerplate/lyria-client.ts`. It needs `@google-cloud/aiplatform` and Application Default Credentials.
- Copy when wiring playback in the browser: `boilerplate/audio-manager.ts`.
- Copy when defining the game's audio states: `templates/sound-config.ts`.
- Read when writing prompts or a regeneration manifest: `templates/prompt-catalog.md`.
- Read when checking a model id, limit or date: `references/sources.md`.

Vendor docs for anything beyond these files:

- Use the `text-to-speech` skill if it is installed, otherwise https://elevenlabs.io/docs/api-reference/text-to-speech/convert.
- Use the `sound-effects` skill if it is installed, otherwise https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert.
- Use the `music` skill if it is installed, otherwise https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music.
- Lyria 2 API reference: https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/lyria-music-generation.

The three ElevenLabs skills come from https://github.com/elevenlabs/skills.

## Code examples

### ElevenLabs: voice line, ambient loop, combat track

```typescript
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
  composeFromPlan,
  composeMusic,
  createMusicPlan,
  generateSfx,
  generateVoiceLine,
  saveAudio,
} from './elevenlabs-audio';

const client = new ElevenLabsClient(); // reads ELEVENLABS_API_KEY

const greeting = await generateVoiceLine(client, {
  text: 'Welcome, traveler. The road ahead is dangerous.',
  voiceId: 'your-merchant-voice-id',
});
await saveAudio('public/audio/voice/merchant/greeting.mp3', greeting);

const rain = await generateSfx(client, {
  text: 'Soft rain on a tin roof, distant thunder',
  durationSeconds: 30,
  loop: true,
});
await saveAudio('public/audio/ambient/rain.mp3', rain);

const combat = await composeMusic(client, {
  prompt: 'Intense battle music, driving and urgent, 150 BPM in D minor, electric guitar riffs, pounding drums, brass stabs',
  musicLengthMs: 60_000,
});
await saveAudio('public/audio/music/combat.mp3', combat);

// Section-level control: inspect or edit the plan, then render it with a seed.
const plan = await createMusicPlan(client, 'Epic boss battle, 160 BPM, full orchestra', 90_000);
const boss = await composeFromPlan(client, plan, 42);
await saveAudio('public/audio/music/boss.mp3', boss);
```

### Lyria 2: combat variations

```typescript
import { createLyriaClient, generateMusic, saveClips } from './lyria-client';

const target = { projectId: process.env.GCP_PROJECT_ID ?? '', location: 'us-central1' };
const lyria = createLyriaClient(target);

const clips = await generateMusic(lyria, target, {
  prompt: 'Intense battle music, driving and urgent, 150 BPM, electric guitar riffs, pounding drums, brass stabs',
  negativePrompt: 'vocals, calm sections, silence',
  sampleCount: 2, // or `seed`, never both
});
await saveClips(clips, 'combat_standard', './output/music/combat');
```

### Audio state machine

```typescript
import { AudioManager } from './audio-manager';
import { AUDIO_CONFIG, type GameAudioState } from './sound-config';

const audio = new AudioManager<GameAudioState>(AUDIO_CONFIG);
audio.unlockMobile();
audio.preload();

audio.transition('menu'); // starts once the player taps, clicks or presses a key
audio.transition('exploration'); // crossfade, ambient starts
audio.preload(['/audio/music/battle.ogg', '/audio/music/boss.ogg']);
audio.transition('combat'); // 500 ms crossfade from the config
audio.playSfx('/audio/sfx/sword_clash.mp3');
audio.playVoice('/audio/voice/merchant/greeting.mp3'); // ducks the music
```

## Pitfalls

1. Playing before the first user input. Browsers reject `play()` with `NotAllowedError` until the user interacts. `touchend`, `click` and `keydown` count as user activation; `touchstart` does not. `unlockMobile()` listens for the first three and restarts the music that was blocked.
2. Expecting volume control on iOS. iOS Safari ignores `HTMLMediaElement.volume`, so the manager's crossfade, ducking, sliders and mute make no audible change there: during a crossfade both tracks play at full volume until the old one stops. If you move playback to the Web Audio API, note that an `AudioContext` created outside a user gesture starts `suspended`; call `resume()` inside the first click handler.
3. Leaving `model_id` unset. Sound effects and music then use the deprecated `eleven_text_to_sound_v2` and `music_v1`. The boilerplate sets every model id.
4. Getting vocals in ElevenLabs music. Pass `forceInstrumental: true` (the boilerplate default). Lyria 2 is instrumental only; its negative prompt names what to leave out ("vocals"), not "no vocals".
5. Mixing seed modes. ElevenLabs accepts a seed only with a composition plan. Lyria accepts `seed` or `sampleCount`, not both.
6. Naming a band, an artist or copyrighted lyrics in an ElevenLabs music prompt. The API returns `bad_prompt` with a suggested rewrite.
7. Hard cuts between states. Give each transition a crossfade time; fast into danger, slow out of it.
8. One volume slider. Players need separate music, SFX, voice and ambient controls; the manager stores them in `localStorage`.
9. Not preloading combat audio. If combat starts while its track is still loading, the player hears silence. Preload combat and boss tracks during exploration.
10. Hardcoded track paths in game code. Keep the state-to-path map in `sound-config.ts` so swapping a track is one edit.
