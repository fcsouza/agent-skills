---
name: claude-agent-sdk
description: "Build production AI agents with the Claude Agent SDK (TypeScript: @anthropic-ai/claude-agent-sdk, Python: claude-agent-sdk). Use this skill whenever: building programmatic agents with Claude, using query() or ClaudeSDKClient, configuring hooks/subagents/MCP servers/custom tools, setting up permissions or sessions, deploying agents to Docker/CI/CD/cloud, importing @anthropic-ai/claude-agent-sdk or claude-agent-sdk, mentioning 'agent sdk' or 'claude sdk' in a coding context, building autonomous agents that read files/run commands/edit code, or any task involving programmatic Claude Code integration. Even if the user just says 'build an agent' or 'automate with Claude' — use this skill."
---

# Claude Agent SDK

Build AI agents that autonomously read files, run commands, search the web, edit code, and more. The Agent SDK gives you the same tools and agent loop that power Claude Code, programmable in Python and TypeScript.

> **Renamed:** The Claude Code SDK is now the Claude Agent SDK. Package names changed to `claude-agent-sdk` (Python) and `@anthropic-ai/claude-agent-sdk` (TypeScript).

## Quick Start

### Install

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python (uv)
uv init && uv add claude-agent-sdk

# Python (pip)
pip install claude-agent-sdk
```

The TypeScript SDK bundles a native Claude Code binary — no separate install needed.

### Set API Key

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Also supports Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`), Vertex AI (`CLAUDE_CODE_USE_VERTEX=1`), and Azure (`CLAUDE_CODE_USE_FOUNDRY=1`).

### First Agent

```python
# Python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

async def main():
    async for message in query(
        prompt="Find and fix bugs in utils.py",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Glob"],
            permission_mode="acceptEdits",
        ),
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text)
        elif isinstance(message, ResultMessage):
            print(f"Done: {message.subtype}")

asyncio.run(main())
```

```typescript
// TypeScript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix bugs in utils.ts",
  options: {
    allowedTools: ["Read", "Edit", "Glob"],
    permissionMode: "acceptEdits"
  }
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) console.log(block.text);
    }
  } else if (message.type === "result") {
    console.log(`Done: ${message.subtype}`);
  }
}
```

## Core Concepts

The agent loop: **Receive prompt → Evaluate → Call tools → Observe results → Repeat → Return result.**

Each round-trip (Claude calls tools, SDK executes, results feed back) is one **turn**. The loop ends when Claude responds with text only (no tool calls), yielding a `ResultMessage`.

## Choosing an Entry Point

| Feature | `query()` | `ClaudeSDKClient` (Python) |
|---|---|---|
| Session | New each call | Reuses same session |
| Multi-turn | Via `resume`/`continue` | Automatic |
| Interrupts | No | Yes (`client.interrupt()`) |
| Best for | One-off tasks, CI/CD | Interactive apps, chatbots |

TypeScript uses `query()` with `continue: true` for multi-turn. For a session-holding client, see the [TypeScript V2 preview](https://code.claude.com/docs/en/agent-sdk/typescript-v2-preview).

```python
# Python multi-turn with ClaudeSDKClient
async with ClaudeSDKClient(options=options) as client:
    await client.query("Analyze the auth module")
    async for msg in client.receive_response():
        print_response(msg)

    await client.query("Now refactor it to use JWT")
    async for msg in client.receive_response():
        print_response(msg)
```

## Configuration

Key options for `ClaudeAgentOptions` (Python) / `Options` (TypeScript):

| Option | Python | TypeScript | Description |
|---|---|---|---|
| Model | `model` | `model` | Claude model ID (e.g. `"claude-sonnet-4-6"`) |
| Effort | `effort` | `effort` | `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"` |
| Max turns | `max_turns` | `maxTurns` | Cap agentic round-trips |
| Max budget | `max_budget_usd` | `maxBudgetUsd` | Cost ceiling in USD |
| Permission mode | `permission_mode` | `permissionMode` | See Permission Modes below |
| Allowed tools | `allowed_tools` | `allowedTools` | Auto-approved tools list |
| Disallowed tools | `disallowed_tools` | `disallowedTools` | Always-denied tools |
| System prompt | `system_prompt` | `systemPrompt` | Custom or preset (`"claude_code"`) |
| Working dir | `cwd` | `cwd` | Agent's working directory |
| MCP servers | `mcp_servers` | `mcpServers` | External tool servers |
| Agents | `agents` | `agents` | Programmatic subagent definitions |
| Hooks | `hooks` | `hooks` | Lifecycle callback hooks |
| Output format | `output_format` | `outputFormat` | Structured JSON output schema |
| Thinking | `thinking` | `thinking` | `{"type": "adaptive"}` or `{"type": "enabled", "budget_tokens": N}` |
| File checkpointing | `enable_file_checkpointing` | `enableFileCheckpointing` | Track file changes for `rewindFiles()` undo |
| Plugins | `plugins` | — | Extend with bundled commands, agents, MCP servers |
| Setting sources | `setting_sources` | `settingSources` | Load CLAUDE.md, skills, hooks from project |

For full type definitions, read `references/typescript-api.md` or `references/python-api.md`.

## Message Handling

The SDK streams messages as the agent works. Key types:

| Type | When | What it contains |
|---|---|---|
| `SystemMessage` (subtype `"init"`) | Session start | Session ID, tools, model, MCP status |
| `AssistantMessage` | Each Claude response | Text blocks + tool call blocks |
| `UserMessage` | After tool execution | Tool results fed back to Claude |
| `ResultMessage` | Loop ends | Final text, cost, usage, session ID |

### Checking ResultMessage

Always check `subtype` before reading `result`:

```python
# Python
if isinstance(message, ResultMessage):
    if message.subtype == "success":
        print(message.result)
        print(f"Cost: ${message.total_cost_usd:.4f}")
    elif message.subtype == "error_max_turns":
        print(f"Hit turn limit. Resume: {message.session_id}")
    elif message.subtype == "error_max_budget_usd":
        print("Hit budget limit.")
```

```typescript
// TypeScript
if (message.type === "result") {
  if (message.subtype === "success") {
    console.log(message.result);
    console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);
  } else if (message.subtype === "error_max_turns") {
    console.log(`Hit turn limit. Resume: ${message.session_id}`);
  }
}
```

Result subtypes: `success`, `error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`.

## Permission Modes

| Mode | Behavior | Use case |
|---|---|---|
| `default` | Unmatched tools trigger `canUseTool` callback | Custom approval flows |
| `acceptEdits` | Auto-approve Edit/Write + filesystem cmds (mkdir, rm, mv, cp, sed) within cwd | Trusted dev workflows |
| `dontAsk` | Deny anything not in `allowedTools` | Locked-down headless agents |
| `plan` | No tool execution, planning only | Pre-implementation review |
| `bypassPermissions` | All tools run without prompts | Sandboxed CI, containers |
| `auto` (TS only) | Model classifier approves/denies each tool call autonomously | Autonomous with guardrails |

**Evaluation order:** Hooks → Deny rules → Permission mode → Allow rules → `canUseTool` callback.

`disallowedTools` blocks tools even in `bypassPermissions` mode. `allowedTools` does NOT constrain `bypassPermissions` — use `disallowedTools` to block specific tools in that mode.

## Built-in Tools

| Tool | What it does |
|---|---|
| `Read` | Read any file |
| `Write` | Create new files |
| `Edit` | Precise edits to existing files |
| `Bash` | Run terminal commands, scripts, git |
| `Monitor` | Watch a background script and react to each output line as an event |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents with regex |
| `WebSearch` | Search the web |
| `WebFetch` | Fetch and parse web pages |
| `Agent` | Spawn subagents |
| `AskUserQuestion` | Ask user clarifying questions |
| `TodoWrite` | Track tasks |
| `ToolSearch` | Dynamically discover and load tools |

## Hooks

Hooks are callback functions that intercept agent behavior at key execution points. Register them in `options.hooks` as a dict/object mapping event names to arrays of matchers.

### Hook Events

| Event | Description | Python | TypeScript |
|---|---|---|---|
| `PreToolUse` | Before tool execution (can block/modify) | Yes | Yes |
| `PostToolUse` | After tool execution | Yes | Yes |
| `PostToolUseFailure` | Tool execution failed | Yes | Yes |
| `UserPromptSubmit` | User submits prompt | Yes | Yes |
| `Stop` | Agent execution stops | Yes | Yes |
| `SubagentStart` | Subagent spawned | Yes | Yes |
| `SubagentStop` | Subagent completed | Yes | Yes |
| `PreCompact` | Before context compaction | Yes | Yes |
| `Notification` | Agent status messages | Yes | Yes |
| `PermissionRequest` | Permission needed | Yes | Yes |
| `SessionStart` / `SessionEnd` | Session lifecycle | No | Yes |

### Hook Pattern

```python
# Python
async def protect_env(input_data, tool_use_id, context):
    file_path = input_data["tool_input"].get("file_path", "")
    if file_path.endswith(".env"):
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": "Cannot modify .env files",
            }
        }
    return {}

options = ClaudeAgentOptions(
    hooks={"PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[protect_env])]}
)
```

```typescript
// TypeScript
const protectEnv: HookCallback = async (input, toolUseID, { signal }) => {
  const preInput = input as PreToolUseHookInput;
  const filePath = (preInput.tool_input as any)?.file_path as string;
  if (filePath?.endsWith(".env")) {
    return {
      hookSpecificOutput: {
        hookEventName: preInput.hook_event_name,
        permissionDecision: "deny",
        permissionDecisionReason: "Cannot modify .env files"
      }
    };
  }
  return {};
};

const options = {
  hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [protectEnv] }] }
};
```

Hooks can: block tools (`permissionDecision: "deny"`), modify inputs (`updatedInput`), inject context (`systemMessage`), auto-approve (`permissionDecision: "allow"`), or run async side effects (`{ async: true }`).

For full hook API and recipes, read `references/hooks-guide.md`.

## Subagents

Spawn specialized agents with isolated context windows. Define them programmatically via the `agents` option:

```python
# Python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Grep", "Glob", "Agent"],
    agents={
        "code-reviewer": AgentDefinition(
            description="Expert code reviewer for security and quality.",
            prompt="Analyze code quality. Be thorough but concise.",
            tools=["Read", "Grep", "Glob"],
            model="sonnet",
        ),
    },
)
```

```typescript
// TypeScript
const options = {
  allowedTools: ["Read", "Grep", "Glob", "Agent"],
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer for security and quality.",
      prompt: "Analyze code quality. Be thorough but concise.",
      tools: ["Read", "Grep", "Glob"],
      model: "sonnet"
    }
  }
};
```

Key `AgentDefinition` fields: `description` (when to use), `prompt` (system prompt), `tools` (restrict tools), `model` (`"sonnet"` / `"opus"` / `"haiku"` / full ID), `maxTurns`, `background`, `effort`, `permissionMode`.

Subagents cannot spawn their own subagents — don't include `Agent` in a subagent's tools.

Include `Agent` in the parent's `allowedTools`. Claude auto-delegates based on descriptions, or use explicit prompting: "Use the code-reviewer agent to..."

**Tracking:** Messages from inside a subagent include `parent_tool_use_id`, letting you identify which subagent produced each message.

**Resuming:** Subagents can be resumed by capturing the `session_id` and `agentId` from the first run, then passing `resume=session_id` with the agent ID in the follow-up prompt. Subagent transcripts persist independently and survive main conversation compaction.

## Custom Tools

Define your own functions Claude can call using in-process MCP servers:

```python
# Python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("get_temperature", "Get current temperature", {"latitude": float, "longitude": float})
async def get_temperature(args):
    # fetch weather data...
    return {"content": [{"type": "text", "text": f"Temperature: {temp}°F"}]}

weather = create_sdk_mcp_server(name="weather", tools=[get_temperature])
options = ClaudeAgentOptions(
    mcp_servers={"weather": weather},
    allowed_tools=["mcp__weather__get_temperature"],
)
```

```typescript
// TypeScript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const getTemp = tool("get_temperature", "Get current temperature", {
  latitude: z.number(), longitude: z.number()
}, async (args) => {
  // fetch weather data...
  return { content: [{ type: "text", text: `Temperature: ${temp}°F` }] };
});

const weather = createSdkMcpServer({ name: "weather", tools: [getTemp] });
const options = {
  mcpServers: { weather },
  allowedTools: ["mcp__weather__get_temperature"]
};
```

Tool naming: `mcp__{server_name}__{tool_name}`. Use `mcp__server__*` wildcards in `allowedTools`.

For schemas, error handling, annotations, and images, read `references/custom-tools.md`.

## MCP Servers (External)

Connect to external tools via MCP — databases, browsers, APIs:

```python
# stdio (local process)
mcp_servers={"github": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": {"GITHUB_TOKEN": token}}}

# HTTP/SSE (remote)
mcp_servers={"api": {"type": "sse", "url": "https://api.example.com/mcp/sse", "headers": {"Authorization": f"Bearer {token}"}}}
```

Transport types: `stdio` (local), `sse` (streaming remote), `http` (non-streaming remote), `sdk` (in-process).

Always add MCP tools to `allowedTools` — they're available but not auto-approved by default. `permissionMode: "acceptEdits"` does NOT auto-approve MCP tools.

## Sessions

| Pattern | How | When |
|---|---|---|
| Continue (most recent) | `continue_conversation=True` / `continue: true` | Single-user, same directory |
| Resume (specific ID) | `resume=session_id` / `resume: sessionId` | Multi-user, restart recovery |
| Fork | `resume=id` + `fork_session=True` / `forkSession: true` | Try alternatives, keep original |

Capture session ID from `ResultMessage.session_id`. Sessions persist conversation, not filesystem — use file checkpointing for file snapshots.

Sessions are stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. The `cwd` must match when resuming.

## User Input

### Tool Approval (`canUseTool`)

Handle permission prompts programmatically:

```python
async def can_use_tool(tool_name, input_data, context):
    if approved:
        return PermissionResultAllow(updated_input=input_data)
    return PermissionResultDeny(message="User rejected")

options = ClaudeAgentOptions(can_use_tool=can_use_tool)
```

### Clarifying Questions (`AskUserQuestion`)

Claude can ask multiple-choice questions. Check `tool_name == "AskUserQuestion"` in your `canUseTool` callback, display questions, collect answers, return them:

```python
return PermissionResultAllow(updated_input={
    "questions": input_data["questions"],
    "answers": {"How should I format output?": "Summary"},
})
```

Include `AskUserQuestion` in your `tools` array if you restrict tools.

## Streaming Input

Pass an `AsyncIterable` as `prompt` (instead of a string) for interactive apps:

```python
# Python
async def messages():
    yield {"type": "user", "message": {"role": "user", "content": "Analyze auth.py"}}
    yield {"type": "user", "message": {"role": "user", "content": [
        {"type": "text", "text": "Check this diagram"},
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
    ]}}

async with ClaudeSDKClient(options) as client:
    await client.query(messages())
    async for msg in client.receive_response(): print(msg)
```

```typescript
// TypeScript
async function* messages() {
  yield { type: "user" as const, message: { role: "user" as const, content: "Analyze auth.ts" } };
}
for await (const msg of query({ prompt: messages(), options })) { /* ... */ }
```

Streaming input enables: image attachments, queued messages, mid-task interruption, and natural multi-turn. Single message mode (string prompt) doesn't support images or interruption.

## Hosting & Deployment

### Container Patterns

| Pattern | Description | Example |
|---|---|---|
| Ephemeral | New container per task, destroy on completion | Bug fix, invoice processing |
| Long-running | Persistent container, multiple SDK processes | Email agent, site builder |
| Hybrid | Ephemeral + hydrated with session history | Deep research, project manager |

### Requirements

- Python 3.10+ or Node.js 18+
- 1 GiB RAM, 5 GiB disk, 1 CPU (minimum)
- Outbound HTTPS to `api.anthropic.com`

### Sandbox Providers

Modal, Cloudflare Sandboxes, Daytona, E2B, Fly Machines, Vercel Sandbox.

For production patterns, cost tracking, and security hardening, read `references/patterns.md`.

## Structured Output

Force Claude to return JSON matching a schema:

```python
options = ClaudeAgentOptions(
    output_format={"type": "json_schema", "schema": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]}},
)
# Access via message.structured_output on ResultMessage
```

## File Checkpointing

Enable `enable_file_checkpointing` / `enableFileCheckpointing` to track file changes. Use `rewindFiles(userMessageId)` to undo changes since a specific message.

## Pre-warming (`startup()` — TypeScript only)

```typescript
const warm = await startup({ options: { maxTurns: 3 } });
const q = warm.query("What files are here?");
for await (const msg of q) { /* ... */ }
warm.close();
```

## Critical Defaults (v0.1.0+)

Since v0.1.0, the SDK no longer behaves like the Claude Code CLI out of the box:

**No system prompt by default.** To get Claude Code's full system prompt:
- Python: `system_prompt={"type": "preset", "preset": "claude_code"}`
- TypeScript: `systemPrompt: { type: "preset", preset: "claude_code" }`

**No settings loaded by default.** CLAUDE.md, skills, slash commands, and `settings.json` are NOT read unless you opt in:
- Python: `setting_sources=["user", "project", "local"]`
- TypeScript: `settingSources: ["user", "project", "local"]`

Pass `[]` or omit entirely for fully isolated behavior — ideal for CI/CD and multi-tenant deployments.

## Troubleshooting

| Issue | Fix |
|---|---|
| `thinking.type.enabled` error with Opus 4.7 | Upgrade to SDK v0.2.111+ |
| MCP server shows "failed" | Check env vars, verify package installed, test network |
| Tools not being called | Add to `allowedTools` (MCP tools need explicit approval) |
| Agent behaves differently than CLI | Set `systemPrompt: { type: "preset", preset: "claude_code" }` — see Critical Defaults |
| System prompt / CLAUDE.md not loading | Set `setting_sources=["project"]` — settings not loaded by default since v0.1.0 |
| Session resume returns fresh session | Ensure `cwd` matches original session |
| `canUseTool` not firing (Python) | Use streaming input mode + dummy `PreToolUse` hook |
| Subagent permissions multiplying | Use `PreToolUse` hooks to auto-approve, or set `permissionMode` on agent |

## Reference Files

Read these for deeper API details — they're loaded on-demand:

| File | When to read |
|---|---|
| `references/typescript-api.md` | Full TS types: Options, Query, messages, hooks, tools |
| `references/python-api.md` | Full Python types: ClaudeAgentOptions, ClaudeSDKClient, messages |
| `references/hooks-guide.md` | All hook events, callback signatures, recipes |
| `references/patterns.md` | Production hosting, session strategies, cost tracking |
| `references/custom-tools.md` | tool() decorator, schemas, error handling, annotations |
