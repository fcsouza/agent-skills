---
tags: [rubric, redis, session, ephemeral-state]
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: Reply with the full answer in this chat. Do not create or edit files.
---

Players in my game have ephemeral session state (current room, health, position) that needs to be read on every tick. Design the Redis key schema and expiry strategy.
