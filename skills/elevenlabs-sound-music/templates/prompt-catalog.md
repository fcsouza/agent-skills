# Audio Prompt Catalog

Templates for both ElevenLabs and Vertex AI Lyria. Genre-agnostic — adapt descriptions to your game's setting.

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

## Vertex AI Lyria — Music

### Menu Theme
- **Orchestral**: "Orchestral fantasy theme, majestic and inviting, 90 BPM, strings lead with gentle brass, harp arpeggios, warm atmosphere, main menu music"
- **Chiptune**: "8-bit chiptune main menu theme, catchy melody, 100 BPM, square wave lead, pulse bass, triangle arpeggios, retro style"
- **Lo-fi**: "Lo-fi hip hop beat, chill and relaxed, 80 BPM, Rhodes piano, vinyl crackle, smooth bass, menu screen"
- **Negative**: "no vocals, no sound effects, no sudden changes, no dissonance"

### Exploration / Overworld
- **Fantasy**: "Medieval fantasy exploration, adventurous and curious, 100 BPM, acoustic guitar, flute melody, light percussion, open world"
- **Sci-fi**: "Synthwave exploration, mysterious and atmospheric, 95 BPM, analog synth pads, arpeggiated sequences, deep bass"
- **Dark**: "Dark ambient exploration, ominous and tense, 70 BPM, low drones, distant echoes, subtle percussion"

### Combat / Battle
- **Standard**: "Intense battle music, driving and urgent, 150 BPM, electric guitar riffs, pounding drums, brass stabs"
- **Boss**: "Epic boss battle, dramatic and escalating, 160 BPM, full orchestra, choir-like synths, heavy percussion, timpani"
- **Stealth**: "Tense stealth music, suspenseful, 120 BPM, pizzicato strings, muted percussion, electronic pulses"

### Town / Social
- **Medieval**: "Medieval town music, cheerful and bustling, 110 BPM, lute melody, recorder, light tambourine"
- **Peaceful**: "Peaceful village theme, warm and nostalgic, 95 BPM, acoustic guitar, gentle piano, cozy atmosphere"

### Idle / Background
- **Ambient**: "Minimal ambient music, ethereal, 60 BPM, soft synth pads, occasional piano notes, spacious, idle gameplay"
- **Nature**: "Nature-inspired ambient, peaceful, 70 BPM, wind chimes, flowing water, gentle strings"

### Stingers (short clips)
- **Victory**: "Triumphant victory fanfare, celebratory, 130 BPM, brass fanfare, cymbal crash, ascending melody"
- **Defeat**: "Somber defeat music, melancholic, 60 BPM, solo piano, descending notes, minor key"
- **Level up**: "Level up jingle, short and exciting, 140 BPM, ascending chiptune arpeggio, sparkle"

---

## Seed Management

Save seeds for reproducibility:
```json
{
  "trackId": "combat_01",
  "provider": "lyria",
  "prompt": "Intense battle music...",
  "negativePrompt": "no vocals, no sound effects",
  "seed": 42,
  "model": "lyria-002",
  "generatedAt": "2026-03-01"
}
```

- Same seed + same prompt = similar output
- Use different seeds per context for variety
- Store accepted seeds in a manifest file for regeneration
