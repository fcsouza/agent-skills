# Game Music Gen

AI-powered game music generation using Vertex AI Lyria — background music, battle themes, ambient soundscapes, and procedural soundtracks for browser games.

## What It Covers

- Vertex AI Lyria 002 model capabilities and setup
- Prompt crafting for game-appropriate music styles
- Complete prompt templates for all game contexts (menu, combat, exploration, town, idle, victory, defeat)
- Looping strategies for seamless playback
- Audio pipeline (WAV to OGG/MP3, ffmpeg conversion)
- Next.js audio integration with Zustand state management
- Dynamic music system (crossfading based on game state)
- Mobile audio restrictions and workarounds

## File Structure

```
skills/game-music-gen/
├── README.md                          # This file
├── SKILL.md                           # Main skill — model overview, prompt crafting, categories
└── references/
    ├── prompt-catalog.md              # Complete prompt templates per game context
    ├── api-usage.md                   # Vertex AI Lyria TypeScript API reference
    └── audio-pipeline.md             # WAV conversion, looping, Next.js integration
```

## Installation

### Via CLI

```bash
npx skills add fcsouza/agent-skills --skill game-music-gen
```

### Manual

1. Copy the `skills/game-music-gen/` directory into your project's skills folder
2. Reference `SKILL.md` as the entry point
3. Dive into `references/` for implementation details

## Prerequisites

- Google Cloud project with Vertex AI API enabled
- Service account or Application Default Credentials (ADC) authentication
- `ffmpeg` installed for audio format conversion
- `@google-cloud/vertexai` and `google-auth-library` packages
