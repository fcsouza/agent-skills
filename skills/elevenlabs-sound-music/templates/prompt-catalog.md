# Audio Prompt Catalog

Templates for ElevenLabs (voice, SFX, and Music API) and Vertex AI Lyria (alternative for music). Genre-agnostic — adapt descriptions to your game's setting.

---

## ElevenLabs — Voice Lines

### Narrator
- "Deep, authoritative male voice. Calm and measured pacing. Slight echo suggesting a large space. Read as if recounting ancient history."
- "Warm female voice with gentle cadence. Encouraging tone. Read as tutorial guidance for a new player."

### NPC Dialogue
- "[Character name] voice: [age] [gender], [accent/quality]. Emotional state: [emotion]. Context: [situation]."
- Example: "Merchant voice: middle-aged male, jovial and slightly raspy. Emotional state: welcoming. Context: greeting a customer."

### Combat Callouts
- "Short, sharp exclamation. [Gender] voice, strained with effort. One word or short phrase. Context: attacking."
- "Pained grunt. [Gender] voice. Brief, involuntary sound. Context: taking damage."

### System / Tutorial
- "Clear, neutral voice. Professional tone. No emotion. Read as UI system notification."
- "Friendly, upbeat voice. Encouraging. Read as achievement unlock announcement."

---

## ElevenLabs — Sound Effects

### UI Sounds
- "Soft click sound, like tapping a glass button. Short, clean, satisfying."
- "Whoosh transition sound, left to right, 0.3 seconds. Smooth, digital."
- "Notification chime. Two ascending tones, pleasant, not alarming. 0.5 seconds."
- "Error buzz. Low, brief, clearly indicates failure without being harsh."

### Action Sounds
- "Impact sound. Solid hit, medium force. No specific weapon — abstract physical contact."
- "Energy release sound. Bright, crackling, building to a burst. 1 second."
- "Collect/pickup sound. Bright, ascending sparkle. Short and satisfying. 0.3 seconds."

### Ambient Loops
- "Gentle wind through an open space. Occasional distant sounds. Calm, continuous loop."
- "Interior room tone. Quiet hum, distant muffled activity. Warm and enclosed."
- "Crowd ambiance. Multiple voices in background, indistinct. Lively but not overwhelming."

---

## ElevenLabs Music API — Music

Use these prompts with `client.music.compose({ prompt, musicLengthMs })`. Add `instrumental only` to exclude vocals. Specify BPM and key for precision.

### Menu Theme
- **Orchestral**: `"Orchestral fantasy theme, majestic and inviting, 90 BPM in C major, strings lead with gentle brass, harp arpeggios, warm atmosphere, instrumental only"`
- **Chiptune**: `"8-bit chiptune main menu theme, catchy upbeat melody, 100 BPM in G major, square wave lead, pulse bass, retro style, instrumental only"`
- **Lo-fi**: `"Lo-fi hip hop beat, chill and relaxed, 80 BPM in F major, Rhodes piano, vinyl crackle, smooth bass, instrumental only"`

### Exploration / Overworld
- **Fantasy**: `"Medieval fantasy exploration, adventurous and curious, 100 BPM in D major, acoustic guitar, flute melody, light percussion, open world feel, instrumental only"`
- **Sci-fi**: `"Synthwave exploration, mysterious and atmospheric, 95 BPM in A minor, analog synth pads, arpeggiated sequences, deep bass, instrumental only"`
- **Dark**: `"Dark ambient exploration, ominous and tense, 70 BPM in E minor, low drones, distant echoes, subtle percussion, instrumental only"`

### Combat / Battle
- **Standard**: `"Intense battle music, driving and urgent, 150 BPM in D minor, electric guitar riffs, pounding drums, brass stabs, instrumental only"`
- **Boss**: `"Epic boss battle, dramatic and escalating, 160 BPM in B minor, full orchestra, heavy percussion, timpani, cinematic, instrumental only"`
- **Stealth**: `"Tense stealth music, suspenseful, 120 BPM in C minor, pizzicato strings, muted percussion, electronic pulses, instrumental only"`

### Town / Social
- **Medieval**: `"Medieval town music, cheerful and bustling, 110 BPM in G major, lute melody, recorder, light tambourine, instrumental only"`
- **Peaceful**: `"Peaceful village theme, warm and nostalgic, 95 BPM in C major, acoustic guitar, gentle piano, cozy atmosphere, instrumental only"`

### Idle / Background
- **Ambient**: `"Minimal ambient music, ethereal, 60 BPM in A minor, soft synth pads, occasional piano notes, spacious, instrumental only"`
- **Nature**: `"Nature-inspired ambient, peaceful, 70 BPM, wind chimes, flowing water, gentle strings, instrumental only"`

### Stingers (short clips — use musicLengthMs: 5000–10000)
- **Victory**: `"Triumphant victory fanfare, celebratory, 130 BPM in C major, brass fanfare, cymbal crash, ascending melody, instrumental only"`
- **Defeat**: `"Somber defeat music, melancholic, 60 BPM in A minor, solo piano, descending notes, instrumental only"`
- **Level up**: `"Level up jingle, short and exciting, 140 BPM, ascending chiptune arpeggio, sparkle effect, instrumental only"`

### Songs with Vocals (English/Spanish/German/Japanese supported)
- `"Upbeat adventure anthem, sung in English, male vocalist, 120 BPM in D major, rock guitar, driving drums, lyrics begin at 10 seconds"`
- `"Emotional ending ballad, sung in English, female vocalist, 70 BPM in G minor, piano and strings, heartfelt"`

---

## Seed Management

Save seeds for reproducibility:
```json
{
  "trackId": "combat_01",
  "provider": "elevenlabs-music",
  "prompt": "Intense battle music, 150 BPM in D minor, instrumental only",
  "musicLengthMs": 60000,
  "generatedAt": "2026-03-01"
}
```

For Lyria tracks, also record `seed`, `negativePrompt`, and `model` fields.

- Same seed + same prompt = similar output
- Use different seeds per context for variety
- Store accepted seeds in a manifest file for regeneration

---

## Vertex AI Lyria — Music (Alternative)

Use when you need 32.8s WAV output at 48 kHz. Requires a `negativePrompt` to exclude vocals.

| Category | Prompt | Negative Prompt |
|----------|--------|-----------------|
| Menu | `"Orchestral fantasy theme, 90 BPM, strings, harp"` | `"no vocals, no sound effects, no sudden changes"` |
| Combat | `"Intense battle music, 150 BPM, electric guitar, drums"` | `"no vocals, no sound effects, no calm sections"` |
| Exploration | `"Medieval fantasy exploration, 100 BPM, acoustic guitar, flute"` | `"no vocals, no sound effects"` |
| Ambient | `"Minimal ambient, 60 BPM, soft synth pads"` | `"no vocals, no percussion, no abrupt changes"` |
