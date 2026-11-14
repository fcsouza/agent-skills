---
tags: [rubric, payments, stripe, webhooks]
runs: 1
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
append_system_prompt: Reply with the full answer in this chat. Do not create or edit files.
---

Implement a gem bundle purchase flow where players buy 1000 gems for $9.99. Show the checkout session creation, webhook handling, and how to credit gems to the player account.
