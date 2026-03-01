---
name: game-music-gen
version: 1.0.0
description: >-
  Use when generating game music and audio with AI — background music, ambient
  soundscapes, battle themes, menu music, or procedural soundtracks using
  Vertex AI Lyria. Covers prompt crafting for game-appropriate music, looping
  strategies, and audio pipeline integration.
---

# Game Music Gen

AI-powered game music generation using Vertex AI Lyria for browser-based games and interactive experiences.

## Model Overview

**Lyria 002** is Google's music generation model available through Vertex AI.

- **Output**: 32.8-second WAV file at 48 kHz stereo
- **Content**: Instrumental only — no vocals supported
- **Prompts**: English language only
- **Variations**: Generate 1–4 variations per request via `sample_count`
- **Seed**: Integer seed for reproducible outputs — same prompt + seed = same track
- **Negative prompts**: Exclude unwanted styles or elements (e.g., "no vocals, no sound effects")
- **Watermarking**: SynthID watermark applied automatically and invisibly to all outputs

## Setup

### Prerequisites

1. Google Cloud project with **Vertex AI API** enabled
2. Authentication via service account key or Application Default Credentials (ADC)
3. Install the SDK:
   ```bash
   bun add @google-cloud/vertexai
   ```

### Endpoint

```
https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/lyria-002:predict
```

### Authentication

- **Local development**: `gcloud auth application-default login`
- **Service account**: Set `GOOGLE_APPLICATION_CREDENTIALS` env var to key file path
- **Production**: Workload identity (GKE, Cloud Run)

See [references/api-usage.md](references/api-usage.md) for complete TypeScript examples.

## Prompt Crafting for Games

### Structure

```
[genre/style], [mood], [tempo], [instruments], [context]
```

### Example

> 8-bit chiptune, upbeat and adventurous, 140 BPM, square wave leads with triangle bass, exploration theme for a retro RPG

### Genre Anchors

| Anchor | Best For |
|--------|----------|
| Orchestral fantasy | RPGs, adventure, epic moments |
| Lo-fi ambient | Idle screens, menus, casual games |
| 8-bit chiptune | Retro, pixel art, arcade |
| Synthwave | Sci-fi, cyberpunk, racing |
| Medieval folk | Fantasy towns, taverns, shops |
| Dark atmospheric | Horror, dungeons, stealth |

### Mood Words

Heroic, mysterious, peaceful, intense, melancholic, triumphant, ominous, playful, serene, urgent, whimsical, brooding, majestic, ethereal, gritty.

### Standard Negative Prompts

Always include: `no vocals, no spoken word, no sound effects, no silence`

Add context-specific negatives per category below.

## Music Categories

| Context | Style | Tempo | Key Elements | Negative |
|---------|-------|-------|-------------|----------|
| Main menu | Orchestral/ambient | 80–100 BPM | Inviting, sets tone | No intensity |
| Exploration | Folk/ambient | 90–110 BPM | Adventurous, slightly wandering | No urgency |
| Combat | Rock/orchestral | 140–160 BPM | Driving rhythm, brass, percussion | No calm |
| Boss fight | Epic orchestral | 150–180 BPM | Dramatic, escalating, choir-like | No subtlety |
| Town/shop | Folk/acoustic | 100–120 BPM | Cheerful, relaxed, folksy | No drums |
| Idle/background | Lo-fi/ambient | 70–90 BPM | Minimal, unobtrusive, loopable | No complexity |
| Victory | Fanfare | 120 BPM | Triumphant, short, celebratory | No sadness |
| Defeat | Somber | 60 BPM | Melancholic, brief, reflective | No energy |

See [references/prompt-catalog.md](references/prompt-catalog.md) for complete prompt templates per context.

## Looping Strategies

Lyria outputs are **not** seamless loops by default. Use these strategies:

### 1. Crossfade

Overlap the last 2 seconds with the first 2 seconds using the Web Audio API or ffmpeg:

```bash
ffmpeg -i track.ogg -filter_complex "acrossfade=d=2:c1=tri:c2=tri" looped.ogg
```

### 2. Long Generation

Generate multiple clips with the same seed/prompt, stitch them together with crossfades for longer tracks:

```bash
ffmpeg -i clip1.ogg -i clip2.ogg -filter_complex "[0][1]acrossfade=d=3:c1=tri:c2=tri" long_track.ogg
```

### 3. Natural Endpoints

Prompt for "loopable ambient" or "seamless background" and find natural loop points by analyzing the waveform for similar start/end amplitudes.

### 4. Layering

Generate multiple short ambient layers independently. Loop each layer separately and mix them together at different volumes. This creates organic-sounding continuous audio.

## Audio Pipeline Brief

The typical pipeline for browser games:

1. **Generate**: Lyria 002 → WAV (32.8s, 48 kHz stereo)
2. **Convert**: WAV → OGG (primary) / MP3 (fallback) via ffmpeg
3. **Integrate**: `<audio>` elements in Next.js, managed by Zustand store
4. **Playback**: Dynamic music system — crossfade tracks based on game state
5. **Mobile**: Handle iOS/Android audio lock with user interaction gate

See [references/audio-pipeline.md](references/audio-pipeline.md) for complete implementation.

## API Quick Reference

```typescript
const requestBody = {
  instances: [{
    prompt: 'Epic orchestral battle theme, 150 BPM, brass and strings',
    negative_prompt: 'no vocals, no sound effects',
    seed: 42,
  }],
  parameters: {
    sample_count: 2,
  },
};
```

Response contains `predictions[]` — each with `bytesBase64Encoded` (WAV data) and `mimeType`.

See [references/api-usage.md](references/api-usage.md) for complete TypeScript implementation.

## Rate Limits & Cost

- Default: ~10 requests/min (varies by project)
- Each request takes 10–20s to generate
- Budget: ~50 tracks for a game = moderate cost
- Optimize: fewer variations, reuse seeds for refinement

## Cross-References

- **game-asset-gen**: Visual asset generation (sprites, tilesets, UI) to pair with audio
- **game-dev-hub**: Project structure, game loop, state management
