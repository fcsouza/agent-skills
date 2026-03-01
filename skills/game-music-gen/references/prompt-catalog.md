# Prompt Catalog — Game Music Generation

Complete prompt templates for Vertex AI Lyria 002, organized by game context.

All prompts follow the structure: `[genre/style], [mood], [tempo], [instruments], [context]`

Always append the standard negative prompt unless noted: `no vocals, no spoken word, no sound effects, no silence`

---

## Main Menu Theme

### Orchestral

```
Orchestral fantasy theme, majestic and inviting, 90 BPM, strings lead with gentle brass, harp arpeggios, warm and welcoming atmosphere, suitable for a game main menu
```

### Chiptune

```
8-bit chiptune main menu theme, catchy and memorable melody, 100 BPM, square wave lead, pulse bass, triangle arpeggios, retro NES style
```

### Lo-fi

```
Lo-fi hip hop beat, chill and relaxed, 80 BPM, Rhodes piano chords, vinyl crackle, smooth bass, rainy day mood, menu screen music
```

### Negative

```
no vocals, no sound effects, no sudden changes, no dissonance
```

---

## Exploration / Overworld

### Fantasy

```
Medieval fantasy exploration music, adventurous and curious, 100 BPM, acoustic guitar lead, flute melody, light percussion, open world feeling
```

### Sci-fi

```
Synthwave exploration theme, mysterious and atmospheric, 95 BPM, analog synth pads, arpeggiated sequences, deep bass, space exploration mood
```

### Dark

```
Dark ambient exploration, ominous and tense, 70 BPM, low drones, distant echoes, subtle percussion, dungeon crawling atmosphere
```

### Negative

```
no vocals, no sound effects, no sudden loud moments, no silence
```

---

## Combat / Battle

### Standard

```
Intense battle music, driving and urgent, 150 BPM, electric guitar riffs, pounding drums, brass stabs, RPG combat theme
```

### Boss

```
Epic boss battle theme, dramatic and escalating, 160 BPM, full orchestra, choir-like synths, heavy percussion, timpani rolls, heroic brass
```

### Stealth

```
Tense stealth combat music, suspenseful, 120 BPM, pizzicato strings, muted percussion, electronic pulses, spy thriller mood
```

### Negative

```
no vocals, no calm sections, no silence, no sound effects
```

---

## Town / Shop / Social

### Medieval

```
Medieval town music, cheerful and bustling, 110 BPM, lute melody, recorder, light tambourine, market square atmosphere
```

### Peaceful

```
Peaceful village theme, warm and nostalgic, 95 BPM, acoustic guitar, gentle piano, birdsong-like flute, cozy atmosphere
```

### Shop

```
Fantasy shop music, playful and inviting, 105 BPM, xylophone melody, pizzicato strings, light jazz influence, browsing mood
```

### Negative

```
no vocals, no heavy drums, no intensity, no sound effects
```

---

## Idle / Background

### Ambient

```
Minimal ambient music, ethereal and unobtrusive, 60 BPM, soft synth pads, occasional piano notes, vast and spacious, perfect for idle gameplay
```

### Nature

```
Nature-inspired ambient, peaceful and organic, 70 BPM, wind chimes, flowing water suggestion, gentle strings, forest atmosphere
```

### Electronic

```
Minimal electronic ambient, subtle and hypnotic, 75 BPM, soft pulse, filtered synth, light reverb, futuristic idle music
```

### Negative

```
no vocals, no complexity, no sudden changes, no heavy bass
```

---

## Victory / Defeat Stingers

Short tracks (~10 seconds of useful audio from the 32.8s generation). Trim the output to the relevant section.

### Victory

```
Triumphant victory fanfare, celebratory and bright, 130 BPM, brass fanfare, cymbal crash, ascending melody, achievement unlocked feeling
```

### Defeat

```
Somber defeat music, melancholic and brief, 60 BPM, solo piano, descending notes, minor key, game over feeling
```

### Level Up

```
Level up celebration jingle, short and exciting, 140 BPM, ascending chiptune arpeggio, sparkle sounds, achievement
```

### Negative

```
no vocals, no long buildup, no sound effects, no silence
```

---

## Ambient / Atmospheric

### Dungeon

```
Dark dungeon ambiance, eerie and oppressive, 50 BPM, deep drones, dripping water suggestion, distant echoes, stone chamber reverb
```

### Forest

```
Enchanted forest ambiance, mystical and serene, 65 BPM, wind through trees suggestion, distant bird calls, ethereal pads, magical atmosphere
```

### City

```
Bustling city ambiance, lively and energetic, 90 BPM, distant crowd suggestion, various instruments in and out, urban fantasy
```

### Negative

```
no vocals, no prominent melody, no sudden changes, no silence
```

---

## Seed Management

Save the seed for every accepted track so you can reproduce or refine it later.

### Track Record Format

```json
{
  "id": "combat_01",
  "context": "combat",
  "variant": "standard",
  "prompt": "Intense battle music, driving and urgent, 150 BPM, electric guitar riffs, pounding drums, brass stabs, RPG combat theme",
  "negative_prompt": "no vocals, no calm sections, no silence, no sound effects",
  "seed": 12345,
  "model": "lyria-002",
  "sample_index": 0,
  "accepted": true,
  "notes": "Good energy, strong intro. Used as main combat track."
}
```

### Seed Catalog File

Maintain a `seed-catalog.json` at your project root:

```json
{
  "version": "1.0.0",
  "model": "lyria-002",
  "tracks": [
    {
      "id": "menu_orchestral_01",
      "context": "menu",
      "prompt": "Orchestral fantasy theme, majestic and inviting, 90 BPM...",
      "seed": 98765,
      "sample_index": 2,
      "accepted": true
    },
    {
      "id": "combat_standard_01",
      "context": "combat",
      "prompt": "Intense battle music, driving and urgent, 150 BPM...",
      "seed": 12345,
      "sample_index": 0,
      "accepted": true
    }
  ]
}
```

### Seed Strategy

- **Same context, multiple tracks**: Use the same seed with slight prompt variations to maintain consistency (e.g., `combat_01`, `combat_02`)
- **Different contexts**: Use different seeds to ensure variety across menu, combat, exploration, etc.
- **Refinement**: Take the seed of the best variation, tweak the prompt, regenerate
- **Versioning**: When you update a prompt, keep the old seed record and create a new entry
