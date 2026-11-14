# Audio Prompt Catalog

Prompt templates for ElevenLabs (voice, sound effects, music) and Vertex AI Lyria 2 (instrumental music). Genre-agnostic: adapt the descriptions to your game's setting.

---

## Character voice briefs

Text to Speech takes a voice id, not a description. Use a brief to pick a library voice for the character, or to design one with ElevenLabs' Text to Voice model (`eleven_ttv_v3`). Then keep one voice id per character.

### Narrator
- "Deep, authoritative male voice. Calm and measured pacing. Slight echo suggesting a large space. Read as if recounting ancient history."
- "Warm female voice with gentle cadence. Encouraging tone. Read as tutorial guidance for a new player."

### NPC
- "[Character name] voice: [age] [gender], [accent/quality]. Emotional state: [emotion]. Context: [situation]."
- Example: "Merchant voice: middle-aged male, jovial and slightly raspy. Emotional state: welcoming. Context: greeting a customer."

### Combat callouts
- "Short, sharp exclamation. [Gender] voice, strained with effort. One word or short phrase. Context: attacking."
- "Pained grunt. [Gender] voice. Brief, involuntary sound. Context: taking damage."

### System / tutorial
- "Clear, neutral voice. Professional tone. No emotion. Read as UI system notification."
- "Friendly, upbeat voice. Encouraging. Read as achievement unlock announcement."

---

## ElevenLabs — Sound effects

Use with `generateSfx(client, { text, durationSeconds, loop })`. Set the length with `durationSeconds` (0.5 to 30), not in the prompt. SFX v3 follows prompts that describe the action, the setting and the atmosphere, and prompts with several events in order.

### UI sounds
- "Soft click, like tapping a glass button. Short, clean, satisfying."
- "Whoosh transition, left to right. Smooth, digital."
- "Notification chime. Two ascending tones, pleasant, not alarming."
- "Error buzz. Low, brief, clearly signals failure without being harsh."

### Action sounds
- "Impact. Solid hit, medium force. No specific weapon, abstract physical contact."
- "Energy release. Bright, crackling, building to a burst."
- "Collect/pickup. Bright, ascending sparkle. Short and satisfying."
- "Sword being drawn, then clashing with another blade."

### Ambient loops (set `loop: true`)
- "Gentle wind through an open space. Occasional distant sounds. Calm, continuous."
- "Interior room tone. Quiet hum, distant muffled activity. Warm and enclosed."
- "Crowd ambiance. Many indistinct voices in the background. Lively but not overwhelming."

---

## ElevenLabs — Music

Use with `composeMusic(client, { prompt, musicLengthMs })`. The boilerplate sets `forceInstrumental: true`; pass `false` for the vocal songs below. Answer genre, mood, instrumentation, tempo and era in every prompt, or the model picks the most average choice. Do not name a band, an artist or copyrighted lyrics: the API rejects the prompt with `bad_prompt`.

### Menu theme
- **Orchestral**: `"Orchestral fantasy theme, majestic and inviting, 90 BPM in C major, strings lead with gentle brass, harp arpeggios, warm atmosphere"`
- **Chiptune**: `"8-bit chiptune main menu theme, catchy upbeat melody, 100 BPM in G major, square wave lead, pulse bass, retro style"`
- **Lo-fi**: `"Lo-fi hip hop beat, chill and relaxed, 80 BPM in F major, Rhodes piano, vinyl crackle, smooth bass"`

### Exploration / overworld
- **Fantasy**: `"Medieval fantasy exploration, adventurous and curious, 100 BPM in D major, acoustic guitar, flute melody, light percussion, open world feel"`
- **Sci-fi**: `"Synthwave exploration, mysterious and atmospheric, 95 BPM in A minor, analog synth pads, arpeggiated sequences, deep bass"`
- **Dark**: `"Dark ambient exploration, ominous and tense, 70 BPM in E minor, low drones, distant echoes, subtle percussion"`

### Combat / battle
- **Standard**: `"Intense battle music, driving and urgent, 150 BPM in D minor, electric guitar riffs, pounding drums, brass stabs"`
- **Boss**: `"Epic boss battle, dramatic and escalating, 160 BPM in B minor, full orchestra, heavy percussion, timpani, cinematic"`
- **Stealth**: `"Tense stealth music, suspenseful, 120 BPM in C minor, pizzicato strings, muted percussion, electronic pulses"`

### Town / social
- **Medieval**: `"Medieval town music, cheerful and bustling, 110 BPM in G major, lute melody, recorder, light tambourine"`
- **Peaceful**: `"Peaceful village theme, warm and nostalgic, 95 BPM in C major, acoustic guitar, gentle piano, cozy atmosphere"`

### Idle / background
- **Ambient**: `"Minimal ambient music, ethereal, 60 BPM in A minor, soft synth pads, occasional piano notes, spacious"`
- **Nature**: `"Nature-inspired ambient, peaceful, 70 BPM, wind chimes, flowing water, gentle strings"`

### Loops
State the bars, the BPM, the key, and what is left out:
- `"Exploration drum loop, 100 BPM, four bars, no melody, just drums"`

### Stingers (`musicLengthMs` 3000 to 10000)
- **Victory**: `"Triumphant victory fanfare, celebratory, 130 BPM in C major, brass fanfare, cymbal crash, ascending melody"`
- **Defeat**: `"Somber defeat music, melancholic, 60 BPM in A minor, solo piano, descending notes"`
- **Level up**: `"Level up jingle, short and exciting, 140 BPM, ascending chiptune arpeggio, sparkle effect"`

### Songs with vocals (`forceInstrumental: false`)
- `"Upbeat adventure anthem, sung in English, male vocalist, 120 BPM in D major, rock guitar, driving drums, lyrics begin at 10 seconds"`
- `"Emotional ending ballad, sung in English, female vocalist, 70 BPM in G minor, piano and strings, heartfelt"`

---

## Regeneration manifest

Write one entry per accepted file, or the track cannot be regenerated or varied later:

```json
{
  "trackId": "combat_01",
  "provider": "elevenlabs",
  "model": "music_v2_5",
  "prompt": "Intense battle music, 150 BPM in D minor, electric guitar riffs, pounding drums",
  "musicLengthMs": 60000,
  "generatedAt": "2026-11-14"
}
```

- ElevenLabs prompt mode accepts no seed. To regenerate close to a track, store its composition plan (from `createMusicPlan`) and pass the plan with a seed to `composeFromPlan`. ElevenLabs does not guarantee identical output for a seed.
- Lyria: record `seed` and `negativePrompt`. With a seed the model "will attempt to produce the same audio"; `sampleCount` asks for several clips (up to four) but cannot be sent with a seed.

---

## Vertex AI Lyria 2 — Music

Instrumental only, about 30 s per clip (the API reference says 30 s, the model page 32.8 s), WAV at 48 kHz, prompts in US English. The negative prompt lists what to leave out, as plain nouns: write "vocals", not "no vocals".

| Category | Prompt | Negative prompt |
|----------|--------|-----------------|
| Menu | `"Orchestral fantasy theme, 90 BPM, strings, harp"` | `"vocals, sound effects, sudden changes"` |
| Combat | `"Intense battle music, 150 BPM, electric guitar, drums"` | `"vocals, sound effects, calm sections"` |
| Exploration | `"Medieval fantasy exploration, 100 BPM, acoustic guitar, flute"` | `"vocals, sound effects"` |
| Ambient | `"Minimal ambient, 60 BPM, soft synth pads"` | `"vocals, percussion, abrupt changes"` |
