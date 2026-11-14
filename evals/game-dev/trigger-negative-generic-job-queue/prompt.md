---
tags: [trigger, negative]
runs: 1
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: Reply with the full answer in this chat. Do not create or edit files.
---

I need a background job queue with retries and a nightly cron for sending invoice emails from my Node API.
