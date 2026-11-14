---
tags: [rubric, auth, RBAC, permissions]
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: Reply with the full answer in this chat. Do not create or edit files.
---

I need three access levels in my game: regular players, moderators who can mute/ban players, and admins who can reset game state. How do I implement RBAC and protect my endpoints?
