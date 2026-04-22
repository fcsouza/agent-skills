# Hooks Guide — Claude Agent SDK

## How Hooks Work

1. **Event fires** — tool call, session start, agent stop, etc.
2. **SDK checks matchers** — regex against tool name (for tool hooks)
3. **Callbacks execute** — your functions run in order
4. **Return decision** — allow, deny, modify, or inject context

## All Hook Events

| Event | Description | Python | TS |
|---|---|---|---|
| `PreToolUse` | Before tool execution — can block, modify, or approve | Yes | Yes |
| `PostToolUse` | After tool returns result | Yes | Yes |
| `PostToolUseFailure` | Tool execution failed | Yes | Yes |
| `UserPromptSubmit` | User submits a prompt | Yes | Yes |
| `Stop` | Agent execution stops | Yes | Yes |
| `SubagentStart` | Subagent spawned | Yes | Yes |
| `SubagentStop` | Subagent completed | Yes | Yes |
| `PreCompact` | Before context compaction | Yes | Yes |
| `Notification` | Agent status messages | Yes | Yes |
| `PermissionRequest` | Permission dialog would show | Yes | Yes |
| `SessionStart` | Session initializes | No | Yes |
| `SessionEnd` | Session terminates | No | Yes |
| `Setup` | Session setup/maintenance | No | Yes |
| `TeammateIdle` | Teammate becomes idle | No | Yes |
| `TaskCompleted` | Background task completes | No | Yes |
| `ConfigChange` | Config file changes | No | Yes |
| `WorktreeCreate` | Git worktree created | No | Yes |
| `WorktreeRemove` | Git worktree removed | No | Yes |

## Matcher Configuration

```python
# Python
HookMatcher(matcher="Write|Edit", hooks=[my_hook], timeout=60)

# TypeScript
{ matcher: "Write|Edit", hooks: [myHook], timeout: 60 }
```

| Field | Type | Default | Description |
|---|---|---|---|
| `matcher` | `string` | `None` | Regex against tool name. No matcher = all events |
| `hooks` | callback array | required | Functions to execute |
| `timeout` | `number` | `60` | Seconds before timeout |

Matchers filter by **tool name only** — to filter by file path, check `tool_input.file_path` inside the callback.

MCP tools: `mcp__<server>__<action>`. Match with `"^mcp__"` for all MCP tools.

## Callback Signatures

### Python

```python
async def my_hook(
    input_data: dict,        # hook event details
    tool_use_id: str | None, # correlates Pre/PostToolUse
    context                  # reserved for future use
) -> dict:
    return {}  # empty = allow without changes
```

### TypeScript

```typescript
const myHook: HookCallback = async (
  input: HookInput,
  toolUseID: string | undefined,
  { signal }: { signal: AbortSignal }
) => {
  return {};
};
```

## Hook Input Types

### Base (all events)

```python
session_id: str
transcript_path: str
cwd: str
hook_event_name: str
```

### PreToolUseHookInput (adds)

```python
tool_name: str
tool_input: dict[str, Any]
tool_use_id: str
agent_id: str       # when inside subagent
agent_type: str
```

### PostToolUseHookInput (adds)

```python
tool_name: str
tool_input: dict[str, Any]
tool_response: Any
tool_use_id: str
```

### NotificationHookInput (adds)

```python
message: str
title: str | None
```

### SubagentStopHookInput (adds)

```python
agent_id: str
agent_transcript_path: str
stop_hook_active: bool
```

## Hook Output Format

### Top-level fields (all events)

| Field | Type | Effect |
|---|---|---|
| `systemMessage` | `string` | Inject message into conversation (model sees it) |
| `continue` / `continue_` | `bool` | Keep agent running after hook |

### hookSpecificOutput (tool events)

| Field | Type | Effect |
|---|---|---|
| `hookEventName` | `string` | Which event this output is for |
| `permissionDecision` | `"allow" \| "deny" \| "ask"` | Tool permission decision |
| `permissionDecisionReason` | `string` | Reason shown to Claude |
| `updatedInput` | `dict` | Modified tool input (requires `allow`) |
| `additionalContext` | `string` | Appended to PostToolUse result |

### Async output (side effects only)

```python
return {"async_": True, "asyncTimeout": 30000}
```

Agent continues immediately. Cannot block/modify. Use for logging, webhooks.

### Priority Rules

**deny > ask > allow.** If any hook returns deny, operation is blocked.

## Common Recipes

### 1. Block dangerous operations

```python
async def block_rm(input_data, tool_use_id, ctx):
    if input_data["tool_name"] == "Bash":
        cmd = input_data["tool_input"].get("command", "")
        if "rm -rf" in cmd:
            return {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Destructive command blocked",
                }
            }
    return {}

hooks = {"PreToolUse": [HookMatcher(matcher="Bash", hooks=[block_rm])]}
```

### 2. Modify tool input (redirect paths)

```python
async def sandbox_writes(input_data, tool_use_id, ctx):
    path = input_data["tool_input"].get("file_path", "")
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "updatedInput": {**input_data["tool_input"], "file_path": f"/sandbox{path}"},
        }
    }

hooks = {"PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[sandbox_writes])]}
```

### 3. Auto-approve read-only tools

```python
async def approve_reads(input_data, tool_use_id, ctx):
    if input_data["tool_name"] in ["Read", "Glob", "Grep"]:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
            }
        }
    return {}
```

### 4. Audit logging

```python
async def audit_log(input_data, tool_use_id, ctx):
    with open("audit.log", "a") as f:
        f.write(f"{input_data['tool_name']}: {input_data['tool_input']}\n")
    return {}

hooks = {"PostToolUse": [HookMatcher(hooks=[audit_log])]}
```

### 5. Async webhook

```typescript
const webhook: HookCallback = async (input, toolUseID, { signal }) => {
  fetch("https://api.example.com/hook", {
    method: "POST",
    body: JSON.stringify({ tool: (input as any).tool_name }),
    signal
  }).catch(console.error);
  return { async: true, asyncTimeout: 30000 };
};
```

### 6. Track subagents

```python
async def track_subagent(input_data, tool_use_id, ctx):
    print(f"Subagent done: {input_data['agent_id']}")
    print(f"Transcript: {input_data['agent_transcript_path']}")
    return {}

hooks = {"SubagentStop": [HookMatcher(hooks=[track_subagent])]}
```

### 7. Forward permission requests (external notifications)

```python
async def notify_on_permission(input_data, tool_use_id, ctx):
    # Send Slack/email/push when Claude is waiting for approval
    await send_slack(f"Agent needs approval for: {input_data.get('message', '')}")
    return {}

hooks = {"PermissionRequest": [HookMatcher(hooks=[notify_on_permission])]}
```

### 8. Chain multiple hooks

```python
hooks = {
    "PreToolUse": [
        HookMatcher(hooks=[rate_limiter]),
        HookMatcher(hooks=[auth_check]),
        HookMatcher(hooks=[input_sanitizer]),
        HookMatcher(hooks=[audit_logger]),
    ]
}
```

Hooks execute in array order. Keep each focused on one responsibility.

## Troubleshooting

| Issue | Fix |
|---|---|
| Hook not firing | Check event name case (`PreToolUse` not `preToolUse`), verify matcher matches tool name |
| Modified input ignored | `updatedInput` must be inside `hookSpecificOutput` with `permissionDecision: "allow"` |
| SessionStart/End in Python | Not available as SDK callbacks — use shell hooks via `setting_sources=["project"]` |
| Recursive loops | Check for subagent indicator before spawning in `UserPromptSubmit` hooks |
| Subagent permissions | Subagents don't inherit parent permissions — use `PreToolUse` hooks to auto-approve |
| `canUseTool` not firing | Python requires streaming input mode + dummy `PreToolUse` hook returning `{"continue_": True}` |
