# Game Accessibility Checklist

Use this checklist during design and QA. Check each item when implemented and verified.

---

## Visual Accessibility

- [ ] Color blind mode: Deuteranopia (red-green, most common)
- [ ] Color blind mode: Protanopia (red-green)
- [ ] Color blind mode: Tritanopia (blue-yellow)
- [ ] Never rely on color alone to convey information — use shapes, icons, or labels
- [ ] Text scaling: support at least 2x default text size
- [ ] Minimum font size of 18px (or equivalent) for body text on console/TV
- [ ] High contrast mode with adjustable contrast ratio
- [ ] Minimum contrast ratio of 4.5:1 for normal text, 3:1 for large text
- [ ] UI elements have visible focus indicators
- [ ] Screen shake intensity slider (including off)
- [ ] Flash/strobe effect toggle (off by default for photosensitive players)
- [ ] Adjustable HUD opacity and scaling
- [ ] Option to disable or reduce motion and parallax effects
- [ ] Enemy and NPC outlines or highlight options

## Audio Accessibility

- [ ] Subtitles for all dialogue with speaker identification
- [ ] Subtitle text size options (small, medium, large)
- [ ] Subtitle background opacity slider
- [ ] Closed captions for non-dialogue audio (environmental sounds, music cues)
- [ ] Visual indicators for directional audio cues (e.g., footsteps, gunshots)
- [ ] Separate volume sliders: Master, Music, SFX, Voice, UI
- [ ] Mono audio option (for single-sided hearing)
- [ ] Visual ping/alert system as alternative to audio alerts
- [ ] Important audio cues paired with haptic feedback option

## Motor / Physical Accessibility

- [ ] Fully remappable controls (keyboard and gamepad)
- [ ] Support for alternative input devices
- [ ] Toggle vs hold options for all sustained actions (sprint, aim, crouch)
- [ ] Auto-aim or aim assist with adjustable strength
- [ ] Adjustable input sensitivity and dead zones
- [ ] Difficulty options that reduce required reaction time
- [ ] One-handed control scheme option
- [ ] Adjustable or disable QTE (Quick Time Events)
- [ ] Auto-complete or skip option for timing-critical sequences
- [ ] Pause available at any time (single-player) or timeout extensions (multiplayer)
- [ ] Reduce or disable button mashing requirements
- [ ] Adjustable camera/mouse sensitivity and inversion options

## Cognitive Accessibility

- [ ] Tutorials that can be replayed at any time
- [ ] Clear, persistent objective markers and quest log
- [ ] Adjustable game speed or time-slow option
- [ ] In-game glossary for terms, mechanics, and lore
- [ ] Consistent and predictable UI layout
- [ ] Notification history / log that can be reviewed
- [ ] Reduce information density option (simplified HUD)
- [ ] Waypoint and navigation assistance
- [ ] Save anywhere (or generous auto-save)
- [ ] Difficulty that can be changed at any time without penalty
- [ ] Visual cues for interactable objects (highlights, outlines)
- [ ] Text-to-speech for menus and UI elements
- [ ] Simplified dialogue options or summaries

## Multiplayer-Specific

- [ ] Text chat with adjustable font size
- [ ] Ping system as alternative to voice chat
- [ ] Pre-written message/callout system
- [ ] Voice chat volume and mute per player
- [ ] Extended turn timers option (if applicable)
- [ ] Spectator mode for players who need breaks

---

## Testing Notes

- Test all accessibility features with actual assistive technology when possible
- Include accessibility options in the first-time setup flow, not buried in menus
- Allow accessibility settings to be changed from the main menu before starting the game
- Export/import accessibility settings profiles
- Document accessibility features in marketing materials and store listings
