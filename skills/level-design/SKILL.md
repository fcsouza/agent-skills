---
name: level-design
description: >-
  Level layout, pacing, encounter placement and difficulty curves for any genre. Use when planning a new level or area, fixing players who get lost, stuck or bored, tuning how difficulty rises across a game, or writing a level design document.
---

# Level Design

## Files

- Copy `templates/level-design-doc.md` when you start a level. It holds the layout sketch, beats and encounter list.
- Copy `templates/encounter-template.md` when you design one encounter: win, fail and recovery.
- Read `templates/difficulty-curve.md` when you plan difficulty across the game or one level, or pick difficulty modes.
- Copy `boilerplate/difficulty-curve.ts` when code must compute a difficulty value from a level number or from the gap between player and area level. Treat the curve shapes as starting points to tune, not as tested values.
- Read `references/sources.md` when you need the source behind a claim here.

## Procedure

### 1. Concept

1. State the level's purpose in the game's progression: what the player learns, feels or achieves.
2. Name the mechanic the level introduces, tests or twists.
3. Write the emotional arc: start, middle, end. A good experience has a hook, rising interest with short rests, and a finale larger than what came before.
4. Set the constraints: playtime, difficulty band, technical budget.

### 2. Mission, then space

Treat the mission (what the player does, in what order, and why) and the space (geometry) as two structures. Write the mission as a list of tasks, locks and keys first. Then lay out a space that supports it. The mission needs flow and pacing. The space needs connectedness, distance and signposting.

### 3. Layout

5. Sketch a top-down map. Mark entry and exit, the main path, side paths, encounters, rest areas and landmarks.
6. Pick the space structure on purpose: linear, grid, web, points in space, or divided space. Mixing them is normal.
7. Give every area a landmark. If you cannot say "you are near the X" for an area, add one. Uniform space is as dull as uniform chaos.
8. Keep a clear main path. Steer with constraints, goals, interface, visual design, characters and music. The player needs to feel free, not to be free.
9. Tie distances to the avatar. Set platform gaps, corridor width and cover spacing from the avatar's speed and jump, and retune both together when either changes. A long, empty run at a speed that serves no gameplay makes players zone out: add objects or decisions along it.
10. Write the three beats for the main path: introduce the mechanic in a safe place, test it with more complexity, then twist it.

### 4. Pacing

11. Draw the interest curve for the level: intensity against progress. Draw it for each major encounter too, since the same shape repeats at every scale.
12. Put a rest between peaks. Cut flat stretches. Padding them dulls the later peaks.
13. Make the finale the largest peak, then give a reward or a cool-down.
14. Raise difficulty in a sawtooth: step up, then give a moment where the player beats something that once beat them or uses an old skill on a harder problem. A straight ramp gives no sense of growth.
15. Make the first levels very easy. Learning the controls is a challenge by itself.

### 5. Teaching

16. Teach by doing. Give each lesson at the moment the player can use it.
17. Introduce at most three new things at once while the player is learning.
18. Do not punish failure while the player is still learning a mechanic.
19. Avoid false affordances: an object that looks useful and is not. Avoid tutorial text with no context.

### 6. Encounters and puzzles

20. Fill in `templates/encounter-template.md` for each encounter. Answer: what does the player learn or prove, what happens on failure, and is there more than one valid approach?
21. For puzzles: make the goal obvious, make starting easy, show progress, and raise difficulty gradually. Give parallel puzzles so a stuck player can switch. Stack small puzzles into a pyramid that feeds a final one.
22. Check the difficulty of each encounter against the level's curve.
23. Do not use hidden dynamic difficulty as the fix for a bad curve. It breaks the sense of a fixed world, players can exploit it by playing badly, and players want to improve by practice. If you use adaptive changes, follow the rules in `templates/difficulty-curve.md`.

### 7. Environmental storytelling

24. Put details in the environment that imply what happened: a locked door with claw marks says more than a log entry. Never put them on the critical path.

### 8. Accessibility pass

25. Check that every important element reads without color alone.
26. Give each audio cue a visual alternative.
27. Check that the critical path needs no precision timing, or offer an alternative.
28. Check text size, subtitles and input remapping. See `ui-ux-game` for the full checklist.

### 9. Playtest

29. Plan the test: what you want to learn, who tests (fresh players, not only the team), and what you log. Log events such as time per area and deaths per encounter.
30. Watch silently. Record where players get lost, get stuck, get bored or miss content. Test novices and experts.
31. Ask for the three least-liked parts, not one. Do not defend the level. Do not ask testers to design it.
32. Change the level from what you saw, not from preference. Where players get stuck is a design failure.

## Pitfalls

- A straight corridor with no choice. A fork that reconnects gives agency.
- A hard encounter after easy ones with no buildup. Ramp into it.
- Empty space with no encounter, story, resource or view.
- Visual language that changes between areas. If glowing means "interactable" in one place, it means that everywhere.
- A boring tutorial. Players leave before the main game.
- A waypoint marker used to cover a confusing layout. Fix the layout first.
- Designing from what you know. You know the solution. The player does not.
- Pacing tuned in a ten-minute test. Flow shows only in long observation.

## Cross-references

- `game-design-fundamentals`: pillars and mechanics framework.
- `quest-mission-design`: mission structure that overlays a level.
- `worldbuilding`: lore and world rules behind an environment.
- `ui-ux-game`: HUD, minimap, waypoints and the accessibility checklist.
- `procedural-gen`: generating layouts. The mission-then-space split in step 2 applies there too.
