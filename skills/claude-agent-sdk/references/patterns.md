# Production Patterns — Claude Agent SDK

## Hosting Architectures

### Ephemeral Sessions

New container per task. Destroy on completion.

```
User request → Spin up container → Run SDK → Return result → Destroy
```

**Best for:** Bug fixes, invoice processing, translations, image processing, one-off automation.

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
    permission_mode="bypassPermissions",
    max_turns=30,
    max_budget_usd=5.0,
)
```

### Long-Running Sessions

Persistent containers running multiple SDK processes based on demand.

**Best for:** Email agents, site builders, chatbots, high-frequency message handlers.

```python
async with ClaudeSDKClient(options) as client:
    while True:
        prompt = await get_next_message()
        await client.query(prompt)
        async for msg in client.receive_response():
            await send_to_user(msg)
```

### Hybrid Sessions

Ephemeral containers hydrated with session history from DB or SDK session resume.

**Best for:** Deep research, project management, support tickets — intermittent interaction.

```python
options = ClaudeAgentOptions(
    resume=saved_session_id,
    allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
)
```

### Single Container

Multiple SDK processes in one container. Agents collaborate or compete.

**Best for:** Simulations, multi-agent systems. Least common — requires preventing file conflicts.

## Container Requirements

| Resource | Minimum |
|---|---|
| Runtime | Python 3.10+ or Node.js 18+ |
| RAM | 1 GiB |
| Disk | 5 GiB |
| CPU | 1 core |
| Network | Outbound HTTPS to `api.anthropic.com` |

### Sandbox Providers

Modal Sandbox, Cloudflare Sandboxes, Daytona, E2B, Fly Machines, Vercel Sandbox.

---

## Session Management

### Within One Process

**Python:** `ClaudeSDKClient` tracks session IDs internally. Each `client.query()` continues the same session.

**TypeScript:** Use `continue: true` on subsequent `query()` calls — picks up most recent session in `cwd`.

### Across Process Restarts

1. Capture `session_id` from `ResultMessage`
2. Store it (database, file, environment)
3. Pass to `resume` on next `query()`

```python
# Save
session_id = result_message.session_id

# Resume later
options = ClaudeAgentOptions(resume=session_id)
```

Sessions stored at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. The `cwd` must match when resuming.

### Cross-Host Resumption

Option 1: Mirror `.jsonl` session files to shared storage (S3, NFS). Restore to same path on new host.

Option 2: Don't rely on session resume. Capture results as app state and pass into a fresh session prompt. Often more robust.

### Forking Sessions

Creates new session with copy of original history. Original stays unchanged.

```python
async for msg in query(
    prompt="Try a different approach",
    options=ClaudeAgentOptions(resume=session_id, fork_session=True),
):
    if isinstance(msg, ResultMessage):
        forked_id = msg.session_id  # new ID
```

Forking branches conversation, not filesystem. File changes are real.

---

## Subagent Orchestration

### Context Isolation

Each subagent starts fresh — no parent conversation. Only the Agent tool's prompt string transfers context. Include file paths, errors, decisions explicitly.

| Subagent receives | Does NOT receive |
|---|---|
| Its own system prompt + Agent tool prompt | Parent's conversation history |
| Project CLAUDE.md (via settingSources) | Parent's system prompt |
| Tool definitions (inherited or scoped) | Skills (unless in AgentDefinition.skills) |

Only final message returns to parent — keeps parent context lean.

### Common Tool Combinations

| Use case | Tools |
|---|---|
| Read-only analysis | `Read`, `Grep`, `Glob` |
| Test execution | `Bash`, `Read`, `Grep` |
| Code modification | `Read`, `Edit`, `Write`, `Grep`, `Glob` |
| Full access | Omit `tools` field (inherits all) |

Subagents cannot nest — don't include `Agent` in a subagent's tools.

### Resuming Subagents

Subagents can be resumed to continue where they left off. Capture `session_id` and `agentId` from the first run:

```typescript
let agentId: string | undefined;
let sessionId: string | undefined;

for await (const msg of query({ prompt: "Use Explore agent to find endpoints", options })) {
  if ("session_id" in msg) sessionId = msg.session_id;
  // agentId appears in Agent tool result content
  const content = JSON.stringify((msg as any).message?.content ?? "");
  const match = content.match(/agentId:\s*([a-f0-9-]+)/);
  if (match) agentId = match[1];
}

// Resume with full context
for await (const msg of query({
  prompt: `Resume agent ${agentId} and list the most complex endpoints`,
  options: { ...options, resume: sessionId },
})) { /* ... */ }
```

Subagent transcripts persist independently — they survive main conversation compaction and can be resumed after process restarts.

### Dynamic Agent Configuration

```python
def create_reviewer(level: str) -> AgentDefinition:
    return AgentDefinition(
        description="Security reviewer",
        prompt=f"You are a {'strict' if level == 'strict' else 'balanced'} reviewer.",
        tools=["Read", "Grep", "Glob"],
        model="opus" if level == "strict" else "sonnet",
    )
```

---

## Cost Tracking

### ResultMessage Fields

```python
result.total_cost_usd     # total API cost
result.usage              # {input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}
result.model_usage        # per-model breakdown
result.num_turns          # tool-use round trips
result.duration_ms        # wall clock time
```

### Budget Control

```python
options = ClaudeAgentOptions(
    max_budget_usd=10.0,     # hard ceiling
    max_turns=50,            # prevent runaway loops
    effort="medium",         # lower tokens per turn
)
```

Result subtype `error_max_budget_usd` or `error_max_turns` when limits hit. Resume with higher limits if needed.

### Reducing Cost

- Lower `effort` for simple tasks (`"low"` or `"medium"`)
- Use `"sonnet"` or `"haiku"` for subagents doing mechanical work
- Scope `tools` to minimum needed (fewer definitions = less context)
- Use `ToolSearch` for large tool sets (defers loading)

---

## Context Efficiency

- **Subagents** isolate context — intermediate results stay in subagent
- **Scope tools** per subagent (every tool definition consumes context)
- **MCP tool search** loads tools on demand instead of preloading all
- **CLAUDE.md** persists across compaction — put persistent rules there, not in prompts
- **Manual compaction** — send `"/compact"` as prompt string
- **`PreCompact` hook** — archive transcript before summarization

---

## CI/CD Integration

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage

async def ci_agent(task: str) -> str:
    async for msg in query(
        prompt=task,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
            permission_mode="dontAsk",  # deny unknown tools, no prompts
            max_turns=30,
            max_budget_usd=5.0,
            setting_sources=["project"],  # load CLAUDE.md
        ),
    ):
        if isinstance(msg, ResultMessage):
            if msg.subtype == "success":
                return msg.result
            raise RuntimeError(f"Agent failed: {msg.subtype}")
```

Use `dontAsk` with explicit `allowedTools` for predictable CI behavior. Use `bypassPermissions` only in fully sandboxed containers.

---

## Security

- **Always containerize** production agents — `bypassPermissions` grants full system access
- **`disallowedTools`** blocks tools even in `bypassPermissions` mode
- **Pass credentials via `env`**, never in prompts or system prompts
- **Use hooks** to enforce security policies (block paths, sanitize inputs)
- **Scope subagent tools** — a read-only subagent can't accidentally delete files
- **Set `max_budget_usd`** as a safety net against runaway costs
