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

### Multi-agent Container

Multiple SDK processes in one container. Agents collaborate or compete.

**Best for:** Simulations, multi-agent systems. Least common — requires preventing file conflicts and settings leakage. See [Multi-tenant Isolation](#multi-tenant-isolation) for setup.

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

### Cross-Host Resumption with `sessionStore`

Pass a `SessionStore` adapter so session transcripts are mirrored to external storage. Any host can then resume the session by ID:

```typescript
import { query, type SessionStore } from "@anthropic-ai/claude-agent-sdk";

// sessionStore: your S3, Redis, or Postgres adapter
for await (const msg of query({
  prompt: userInput,
  options: { resume: sessionId, sessionStore },
})) { /* ... */ }
```

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for msg in query(
    prompt=user_input,
    options=ClaudeAgentOptions(resume=session_id, session_store=session_store),
):
    ...
```

Three behaviors to know:
- **Transcripts only:** `SessionStore` mirrors session `.jsonl` files. It does NOT mirror `CLAUDE.md` memory files or working-directory artifacts — sync those separately (mounted volume or object-store).
- **Mirror, not replacement:** the subprocess writes to local disk first; the store receives a copy of each batch. Local disk remains authoritative.
- **`mirror_error`:** a failed batch is retried up to 3× total with backoff; a timed-out call is not retried. If the batch still fails, the SDK drops it, emits `{ type: "system", subtype: "mirror_error" }`, and continues. Alert on these if store durability matters.

Reference adapters for S3, Redis, and Postgres: see [session-storage docs](https://code.claude.com/docs/en/agent-sdk/session-storage#reference-implementations).

**Fallback option:** capture results as app state and pass into a fresh session prompt. Often more robust for simple workloads.

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

As of Claude Code v2.1.172, subagents can spawn their own subagents up to 5 levels deep. The 5th-level subagent cannot spawn further. Include `Agent` in a subagent's tools only when nesting is intentional; omit it or add it to `disallowedTools` to prevent a subagent from spawning.

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

---

## Multi-tenant Isolation

When a single container serves multiple tenants, the SDK's default behavior reads shared `CLAUDE.md` files and settings from the filesystem, which can leak one tenant's context into another's session. Isolate tenants with four SDK-level options:

```typescript
// TypeScript
for await (const msg of query({
  prompt,
  options: {
    cwd: tenantDir,                    // per-tenant working directory
    settingSources: [],                 // no filesystem settings loaded
    env: {
      ...process.env,                   // keep PATH, ANTHROPIC_API_KEY, etc.
      CLAUDE_CONFIG_DIR: configDir,     // per-tenant config directory
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",  // disable auto memory
    },
  },
})) { /* ... */ }
```

```python
# Python — env is merged on top of inherited environment
async for msg in query(
    prompt=prompt,
    options=ClaudeAgentOptions(
        cwd=tenant_dir,
        setting_sources=[],
        env={
            "CLAUDE_CONFIG_DIR": config_dir,
            "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
        },
    ),
):
    ...
```

| Mechanism | What it prevents |
|---|---|
| `settingSources: []` | Stops loading user/project/local `settings.json` and `CLAUDE.md` |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | Stops auto-loading `~/.claude/projects/<project>/memory/` into the system prompt (not controlled by `settingSources`) |
| `CLAUDE_CONFIG_DIR` per tenant | Isolates `~/.claude.json` global config so tenants don't share API key cache or login state |
| `cwd` per tenant | Keeps each tenant's working directory separate |

Apply per-tenant egress rules at your proxy (distinct outbound IPs or domain allowlists) so a compromised tenant can't exfiltrate data via another tenant's outbound policy.
