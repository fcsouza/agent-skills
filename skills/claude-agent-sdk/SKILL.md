---
name: claude-agent-sdk
description: >-
  Decisions, patterns and pitfalls for building agents with the Claude Agent SDK (TypeScript package @anthropic-ai/claude-agent-sdk, Python package claude-agent-sdk): permissions, settings isolation, subagents, hooks, custom tools, sessions, hosting. Use when writing or reviewing code that calls the SDK's query() or ClaudeSDKClient, or when deciding how to run, secure, cap or host such an agent.
---

# Claude Agent SDK

The SDK runs the Claude Code binary as a subprocess and talks to it over stdio. Your code configures it and reads a stream of messages. Versions checked on 2026-11-15: `@anthropic-ai/claude-agent-sdk` 0.3.325, `claude-agent-sdk` 0.2.182 (Python 3.10+; Node 18.14+).

## Use the official docs for the API

For the Messages API, use the `claude-api` skill if it is installed. For this SDK there is no official skill, so read the docs. Fetch the index at https://code.claude.com/docs/llms.txt and open the Agent SDK pages as `.md`. Start with these:

- Options and types: https://code.claude.com/docs/en/agent-sdk/typescript.md and https://code.claude.com/docs/en/agent-sdk/python.md
- Permissions: https://code.claude.com/docs/en/agent-sdk/permissions.md
- Hooks: https://code.claude.com/docs/en/agent-sdk/hooks.md
- Subagents: https://code.claude.com/docs/en/agent-sdk/subagents.md
- Custom tools and MCP: https://code.claude.com/docs/en/agent-sdk/custom-tools.md and https://code.claude.com/docs/en/agent-sdk/mcp.md
- Sessions and storage: https://code.claude.com/docs/en/agent-sdk/sessions.md and https://code.claude.com/docs/en/agent-sdk/session-storage.md
- Hosting and security: https://code.claude.com/docs/en/agent-sdk/hosting.md and https://code.claude.com/docs/en/agent-sdk/secure-deployment.md
- Model IDs: https://platform.claude.com/docs/en/about-claude/models/overview.md
- Structured output: https://code.claude.com/docs/en/agent-sdk/structured-outputs.md
- Cost and usage tracking: https://code.claude.com/docs/en/agent-sdk/cost-tracking.md
- Streaming input, interrupts and images: https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode.md
- `AskUserQuestion` and approvals: https://code.claude.com/docs/en/agent-sdk/user-input.md
- Pre-warming a subprocess with `startup()` or `prewarm()` (TypeScript only): the "startup" and "prewarm" sections of the TypeScript reference above

Do not copy option tables, hook-event lists or type definitions into answers from memory. They change with each release. Open the page, then quote the field name.

## Pick the runtime first

- Agent SDK: your process runs Claude Code's loop, tools, permissions and sessions. Use it for coding agents, CI agents and file-and-shell work.
- Client SDK (Messages API): you write the tool loop yourself. Use it when you need no built-in file or shell tools.
- Managed Agents: Anthropic hosts the loop and the sandbox. Use it when you do not want to operate containers.
- Another language: run `claude -p --output-format json` as a subprocess.

## Entry points

- `query()` starts a new session on every call. Use it for one-off and CI tasks. For multi-turn in TypeScript, pass an `AsyncIterable` of user messages as `prompt`, or pass `continue: true` / `resume: sessionId`.
- `ClaudeSDKClient` (Python) keeps one session across `client.query()` calls and supports `interrupt()`.
- The TypeScript V2 session API (`unstable_v2_*`) was removed in 0.3.142. Do not use it. Use `query()`.
- Always branch on `ResultMessage.subtype` before reading `result`. `success` is the only subtype that carries a final answer. The others are `error_max_turns`, `error_max_budget_usd`, `error_during_execution` and `error_max_structured_output_retries`.

Copy `templates/ci-agent.ts` (TypeScript) or `templates/agent.py` (Python) when you need a headless agent with caps and a result check.

## Permissions

The SDK checks every tool call in six steps. The first step that decides wins:

1. Hooks. A hook can deny or pass. A hook that returns `allow` does not skip steps 2 and 3.
2. Deny rules (`disallowedTools`, and deny rules from loaded settings files). They deny in every mode, `bypassPermissions` included.
3. Ask rules (from settings.json). A match goes to `canUseTool`, even in `bypassPermissions`.
4. Permission mode.
5. Allow rules (`allowedTools`, allow rules from settings). Safe reads inside the working directory also resolve here.
6. `canUseTool` callback. In `dontAsk` mode this step is skipped and the call is denied.

What follows from that order:

- `allowedTools` approves the tools it lists. It does not restrict Claude to them. Unlisted tools fall through to the mode and `canUseTool`. To remove a tool, use `disallowedTools`. A bare tool name there removes the tool definition. A pattern like `Bash(rm *)` keeps `Bash` and denies matching calls.
- An allow rule for a tool name hides that tool's calls from `canUseTool`. If your callback must see them, remove the name from `allowedTools`. The SDK warns with code `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` for this and for `bypassPermissions`.
- For headless agents use `dontAsk` with an explicit `allowedTools`. A call that would need approval is then denied instead of waiting for a prompt that nobody answers. Calls that need no approval in `default` mode still run: reads in the working directory, read-only Bash commands, and others the permissions page lists. Add `disallowedTools` for anything that must never run.
- `bypassPermissions` approves almost everything that reaches step 4. In TypeScript it also needs `allowDangerouslySkipPermissions: true`. Use it only inside a container that holds nothing you cannot lose. Put checks that must still run in a `PreToolUse` hook or in `disallowedTools`.
- List MCP tools in `allowedTools` as `mcp__<server>__<tool>`, or `mcp__<server>__*`. A glob is accepted only after a literal `mcp__<server>__` prefix. `["*"]` and `["mcp__*"]` in `allowedTools` are ignored.
- Python: `can_use_tool` needs streaming input plus a dummy `PreToolUse` hook that keeps the stream open. The code is on https://code.claude.com/docs/en/agent-sdk/user-input.md.

## Defaults that surprise people

- Settings load by default. With `settingSources` / `setting_sources` omitted, `query()` loads user, project and local settings, the same as the CLI. That includes CLAUDE.md, skills, hooks and permission rules from the host. Pass `[]` for CI, multi-tenant and any run that must not depend on the machine. Endpoint-managed policy still loads. Server-managed settings are still fetched when the process authenticates with a qualifying credential: an organization OAuth login, a directly configured API key, or a `user_oauth` profile.
- `settingSources: []` does not stop everything. Auto memory still loads into the system prompt, so also set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. `~/.claude.json` is always read; relocate it with `CLAUDE_CONFIG_DIR` in `env`.
- The system prompt is minimal by default. It covers tool calling but leaves out the Claude Code preset's safety instructions. For CLI-like behaviour set `systemPrompt: { type: 'preset', preset: 'claude_code' }` (Python: `system_prompt={'type': 'preset', 'preset': 'claude_code'}`). CLAUDE.md loading is controlled by setting sources, not by the preset.
- In TypeScript, `env` replaces the subprocess environment. Spread `process.env` into it. In Python, `env` merges into the inherited environment.
- Model IDs. Use what the models page lists today: `claude-fable-5-2`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`. A subagent's `model` also accepts the aliases `fable`, `opus`, `sonnet`, `haiku` and `inherit`. Re-open the page before you write an ID into new code.
- Python options that do not exist in 0.2.182: `executable`. Check any other name against the `ClaudeAgentOptions` page before use. `executable` is a TypeScript option (`'bun' | 'deno' | 'node'`, auto-detected).

## Caps and cost

- `maxTurns` counts each turn that calls tools, plus one for the final text-only reply. Set it at least one above the number of tool turns you expect, or the run ends with `error_max_turns` and no final answer.
- `maxBudgetUsd` is checked after each model response. The response that crosses the cap still completes, and subagents still running add to it. Leave headroom.
- Subagents spend against the same query. Cap their growth through `env`: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (default 3 layers below the main agent, `1` stops nesting) and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (default 20). These limits apply from TypeScript SDK 0.3.219 and Python SDK 0.2.127. Older releases lack some of them or default differently.
- Set `effort` lower and pick a smaller `model` for mechanical subagents.

## Subagents

- A subagent starts with an empty conversation. Only the prompt string you or Claude pass to the Agent tool carries context. Put file paths, errors and decisions in it.
- Only the subagent's final message returns to the parent.
- Claude delegates through the `Agent` tool. If you restrict the parent with `tools`, keep `Agent` in the list. Give a subagent `Agent` only when nesting is intended.
- Restrict `tools` per subagent. Omitting `tools` inherits everything available to subagents.
- To resume a subagent, keep the parent `session_id`, read `agentId` from the Agent tool result, and pass `resume: sessionId` with the agent ID in the prompt. The built-in `Explore` and `Plan` agents are one-shot and return no `agentId`.
- Messages from inside a subagent carry `parent_tool_use_id`.

Copy `templates/subagents.ts` for a read-only reviewer with depth and concurrency caps.

## Hooks and custom tools

- Hooks run in your process and can deny, rewrite input, add context or run side effects. Matchers filter on tool name only. To filter on a path, read `tool_input` in the callback. If a callback throws, the action goes ahead by default. A `PreToolUse` guard that must fail closed needs `onFailure: 'block'` (Python: `on_failure='block'`) on the matcher, from TypeScript SDK 0.3.317 and Python SDK 0.2.177. A guard on `Write|Edit` does not cover Bash.
- `SessionStart`, `SessionEnd` and several other events are TypeScript-only. Check the hooks page table before you plan a Python hook.
- A custom tool is an in-process MCP server: `tool()` plus `createSdkMcpServer()` in TypeScript, `@tool` plus `create_sdk_mcp_server()` in Python. Catch errors in the handler and return `isError: true` with a message you wrote. An uncaught exception does not stop the loop. The SDK turns it into an error result that carries the raw exception text, and Claude reads that text.

Copy `templates/guard-hook.ts` when you need a `PreToolUse` deny hook and a custom tool with its `allowedTools` entry.

## Sessions

- Capture `session_id` from the `ResultMessage`. Use `resume` for a known session, `continue` for the most recent one in `cwd`, and `forkSession` to branch.
- A session is a transcript, not a filesystem. Forking does not undo file changes. Use `enableFileCheckpointing` and `rewindFiles()` for that.
- Transcripts live in `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`, or under `$CLAUDE_CONFIG_DIR/projects/`. Resume from a `cwd` that matches the original run.
- For resume across hosts or container restarts, use a `sessionStore` adapter. It mirrors transcripts only. It does not carry CLAUDE.md or working-directory files. A failed mirror batch is dropped and emits a `mirror_error` system message. Alert on it.

## Hosting

- Each running agent is a long-lived subprocess with a shell, a working directory and local session files. Plan resources per agent. The docs give 1 GiB RAM, 5 GiB disk and 1 CPU as a starting floor, not a ceiling. Measure peak memory on a representative session.
- Pick a session pattern: ephemeral container per task, long-running container, hybrid (ephemeral plus `sessionStore`), or several agents in one container. Deployable examples are in the hosting cookbook linked from the hosting page.
- Multi-tenant in one container: copy `templates/tenant-isolation.ts`. It sets a per-tenant `cwd`, `settingSources: []`, a per-tenant `CLAUDE_CONFIG_DIR` and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Filesystem isolation per tenant is still the stronger boundary. Read the secure-deployment page for egress and credential rules.
- Inject credentials through a proxy outside the agent's sandbox rather than exposing them to it. Never put them in prompts.
- Serverless: the SDK bundles a platform binary as an optional dependency. Measure the installed platform package against your function size limit before you choose Lambda or similar. On this machine the darwin-arm64 package is 332 MB installed.
- Single-file executable with `bun build --compile`: read `references/bun-runtime.md`.

## Pitfalls

- Importing `extractFromBunfs` or `pathToClaudeCodeExecutable` from the package root. Neither is exported there (TS2305 on 0.3.325). `extractFromBunfs` comes from `@anthropic-ai/claude-agent-sdk/extract`, takes the embedded binary path and is synchronous. Do not `await` it.
- Guarding `.env` with a `Write|Edit` hook and leaving Bash open. Block Bash with `disallowedTools: ['Bash']` or add a Bash hook.
- Treating a `PreToolUse` hook or a permission rule as a security boundary. Both check what the tool asked for; a symlink, Bash or a script can still reach the file. `templates/guard-hook.ts` is a name check only. The built-in sandbox bounds shell commands only (https://code.claude.com/docs/en/sandboxing.md); to keep the file tools off a file, run the agent as an OS user that cannot write it, or in a container or VM (https://code.claude.com/docs/en/sandbox-environments.md).
- Writing a model ID from memory. Re-open the models page.

## Files

- `references/bun-runtime.md`: read when the app is compiled with `bun build --compile`, or when choosing the `executable` runtime.
- `references/sources.md`: read when you need the page behind a claim in this skill, or before you change one.
- `templates/ci-agent.ts`: copy when you need a headless TypeScript agent with `dontAsk`, caps and a result check.
- `templates/agent.py`: copy when you need the same agent in Python.
- `templates/guard-hook.ts`: copy when you need a `PreToolUse` deny hook or a custom in-process tool.
- `templates/subagents.ts`: copy when you need a restricted subagent with depth and concurrency caps.
- `templates/tenant-isolation.ts`: copy when one container serves several tenants.
- `templates/bun-compile.ts`: copy when you build a single-file executable with Bun.
- `templates/embedded-binary.d.ts`: copy together with `templates/bun-compile.ts`; it types the embedded binary import.

## Related skills

- `claude-api`, if installed: the Messages API, the advisor tool and model migration. The advisor tool belongs to the Messages API, so this skill does not cover it.
