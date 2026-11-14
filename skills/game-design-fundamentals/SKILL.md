---
name: game-design-fundamentals
description: >-
  Genre-agnostic game design procedures: the design and playtest loop, core loops, difficulty and reward tuning and a design-document template. Use when you are shaping a new game or feature, a loop feels flat, players churn or quit early, or a difficulty curve or reward schedule needs tuning.
---

# Game Design Fundamentals

Procedures for the decisions that come before genre-specific work. Economy, level, quest and progression-tree work have their own skills (see the end).

## Design loop

1. Write experience goals first: the situations and feelings the player should meet, not features. Judge every test against them.
2. Pick an idea early and prototype it. Each prototype answers one stated question. List the biggest risks and build the smallest prototype that tests the worst one.
3. Playtest, compare against the goals, fix the worst issues, retest. Repeat until the goals hold. A faster loop beats a better first idea.
4. Plan each playtest: which specific question it answers, who tests, what you log. Ask testers for their three least-liked parts, not one. Do not explain or defend the game.
5. When players do something unintended, check in this order: a missing system, poor balance, poor communication of a working system.

Read `references/design-procedures.md` when you need the long forms: prototype rules, balance checklist, interest curve, playtest planning.

## Core loop

- Draw the loop as action, feedback, decision, action. Every pass must contain a decision with more than one live option. A choice with one clearly best option, or options that play the same, is not a choice.
- Prototype the moment-to-moment action first and judge how it feels before adding systems. For real-time controls, read `references/game-feel.md`.
- Repetition of one fun action does not carry a game. Bungie's Jaime Griesemer says the point of Halo's loop was varied context (environments, weapons, enemies), not one action repeated. Vary the context of the loop.
- Nest loops: the core loop feeds a session goal, the session goal feeds long-term progress. Write the session loop with a target session length and check progress fits it.

## Difficulty

- Perceived difficulty is (skill challenge + power challenge) minus (player skill + player power). Tune all four terms, not one.
- Raise challenge after each success and give rests. A zig-zag rise suits growing skill better than a straight line. Make the first levels very easy, because learning the controls is a challenge.
- Flow shows only in long observation. A ten-minute test cannot confirm it.
- Dynamic difficulty has three costs: it breaks the sense of a fixed world, players can exploit it by playing badly, and players want to improve by practice. Offer selectable difficulty first.
- Check each skill-challenge step for a dominant strategy. Fix it by giving the options a trade-off, such as a safe small reward against a risky large one with equal expected value.

## Rewards and punishment

- Rewards come in types: praise, points, extra play, access to new content, spectacle, expression, powers or resources, completion. Mix types.
- Players acclimate. Raise reward value as play proceeds, and vary timing: a random schedule tied to player action holds better than a fixed one. Too few rewards demoralise; too many weaken each one. A reward the player cannot explain counts for nothing.
- Punishment gives rewards their value. Use light, stacked costs (short setback, small loss). Permanent loss of long-earned powers feels unfair.
- Players misjudge odds. They expect streaks to break, and six losses in a row at the start reads as unfair even when the odds are fair. Compute expected value, then ask what the player will perceive.
- Never design a penalty for not playing, such as a forced daily streak.

## Onboarding

`ui-ux-game` owns the onboarding rules. Apply them to every tutorial and first-time flow.

## Player types

Bartle's four types (achievers, explorers, socializers, killers) describe players. They are not a targeting recipe. Types interact: adding killers drives socializers away, and a world that adds achievers without any killer pressure loses them unless the team steps in. List the pleasure each system serves (sensation, fantasy, narrative, challenge, fellowship, discovery, expression, submission) and check no system serves none. Both lists leave gaps.

## Pitfalls

1. Systems before feel. Tune the action first.
2. Features that do not feed the loop. Score each element by how many purposes it serves. Merge or cut single-purpose ones. Keep quirks players love.
3. A flat stretch in the interest curve. Cut it. Do not pad it.
4. A flat difficulty curve. Players master the game and leave.
5. Tuning by 10 percent steps. Double or halve a value to learn its direction, then refine.
6. Letting players balance the game. Playtest data replaces opinion.
7. One tester's verdict on feel. Feel changes with skill, so test several skill levels.

## Files

- Read `references/design-procedures.md` for prototype rules, the balance checklist, the interest curve and the playtest plan.
- Read `references/game-feel.md` when the game has real-time controls and the input feels laggy, floaty or stiff.
- Read `references/sources.md` when you need the source behind a claim.
- Copy `templates/gdd-template.md` when you need a short design document.
- Copy `boilerplate/core-loop.ts` when you need a fixed-timestep system manager for a prototype.
- Copy `boilerplate/feedback-system.ts` when you need an event bus, reward triggers and streak tracking for a prototype. Tune its numbers from playtests.

## Related skills

- `game-economy-design` for currencies, sinks and balance of spending.
- `level-design` for spaces, pacing per level and puzzles.
- `quest-mission-design` for mission structure.
- `skill-progression-trees` for unlock graphs.
- `ui-ux-game` for HUD, menus and interface feedback.
- `game-backend-architecture` for server design.
- `elevenlabs-sound-music` for audio generation.
