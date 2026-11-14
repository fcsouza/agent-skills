---
tags: [rubric, redis, leaderboard, sorted-set]
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: Reply with the full answer in this chat. Do not create or edit files.
---

I need a Redis sorted set for a global leaderboard with 1 million players. Show me the commands, data structure, and how to page through the top 100.
