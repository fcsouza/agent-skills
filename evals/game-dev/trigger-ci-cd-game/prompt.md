---
tags: [trigger, topic]
runs: 1
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: Reply with the full answer in this chat. Do not create or edit files.
---

Set up a GitHub Actions pipeline for my game backend: run migrations before deploy, give each pull request its own database, and smoke test after the deploy.
