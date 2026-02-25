# OpenClaw Tools Reference

## Exec Tool

Runs shell commands with foreground/background execution.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `command` | required | Shell command |
| `workdir` | current | Working directory |
| `env` | `{}` | Env var overrides (PATH/LD_*/DYLD_* rejected for host) |
| `yieldMs` | 10000 | Auto-background after delay (ms) |
| `background` | false | Immediately background |
| `timeout` | 1800 | Kill after (seconds) |
| `pty` | false | Pseudo-terminal for TTY tools |
| `host` | `sandbox` | `sandbox` / `gateway` / `node` |
| `security` | `deny` | `deny` / `allowlist` / `full` |
| `ask` | `on-miss` | `off` / `on-miss` / `always` |
| `elevated` | false | Request elevated permissions |

**Sandbox** (default): Isolated Docker. Fails closed if sandboxing is off. **Gateway**: Merges login-shell PATH. **Node**: Paired companion app.

**Security**: Allowlist uses resolved binary paths only. Safe bins (`/bin`, `/usr/bin`) bypass allowlisting. Approvals: `~/.openclaw/exec-approvals.json`. Shell: prefers `bash`/`sh` over `fish`.

**Process management** via `process` tool: `list`, `poll`, `log`, `write`, `kill`, `clear`, `remove`.

**Session overrides**: `/exec host=gateway security=allowlist ask=on-miss node=mac-1`

**apply_patch**: Experimental multi-file edit subtool. Enable under `tools.exec.applyPatch`. OpenAI/Codex models only.

## Browser Tool

Controls dedicated OpenClaw-managed Chromium. Auto-detect order: Chrome, Brave, Edge, Chromium.

**Profiles**: `openclaw` (managed, isolated), `chrome` (extension relay, default), `remote` (custom CDP URL). Config: `browser.defaultProfile`, `browser.profiles.<name>`.

**Core actions**: `navigate`, `click`, `double-click`, `type` (`--submit`), `press`, `hover`, `scrollintoview`, `drag`, `select`, `download`, `fill`, `dialog`, `upload`, `wait`, `evaluate`.

**Snapshots**: AI mode (numeric refs: `click 12`, requires Playwright) and Role mode (element refs: `click e12`, supports `--interactive`, `--compact`, `--depth`, `--labels`). Refs **not stable** across navigations.

**State**: Cookies, localStorage, sessionStorage, custom headers, HTTP auth, geolocation, media preferences, timezone, locale, device presets ("iPhone 14" style).

**Wait**: URL patterns, load states (`networkidle`), JS predicates, element selectors. Combinable.

**Security**: Loopback-only control. Disable `evaluateEnabled` to block arbitrary JS. SSRF policy (`dangerouslyAllowPrivateNetwork`, `hostnameAllowlist`). Treat CDP URLs/tokens as secrets.

**Remote/hosted**: `profiles.<name>.cdpUrl` for Browserless/external. Node browser proxy (auto-routes to paired nodes). Chrome extension relay: `openclaw browser extension install`.

**Sandbox**: Default sandboxed sessions use `target="sandbox"`. Override: `sandbox.browser.allowHostControl: true`.

## Skills System

Skills are Markdown files (`SKILL.md`) injected into agent system prompts. They are NOT executable code.

**SKILL.md format**:
```yaml
---
name: my-skill
description: When to trigger this skill
homepage: https://example.com           # optional
user-invocable: true                    # slash command (default: true)
disable-model-invocation: false         # exclude from prompt (default: false)
command-dispatch: tool                  # optional: bypass model for direct tool call
command-tool: tool-name                 # tool for dispatch mode
command-arg-mode: raw                   # forward unprocessed args
metadata: {"openclaw":{"os":["darwin"],"requires":{"bins":["node"]}}}
---
Skill body — injected into system prompt.
```

**Precedence** (high → low): workspace (`<workspace>/skills/`) → managed (`~/.openclaw/skills/`) → bundled (52 skills) → `skills.load.extraDirs`.

**Gating** via `metadata.openclaw`: `os` (darwin/linux/win32), `requires.bins`, `requires.anyBins`, `requires.env`, `requires.config`, `primaryEnv`, `always: true`.

**Config**:
```jsonc
{
  "skills": {
    "entries": { "skill-name": { "enabled": true, "apiKey": "sk-...", "env": {}, "config": {} } },
    "load": { "extraDirs": [], "watch": true, "watchDebounceMs": 250 },
    "install": { "nodeManager": "npm" }  // npm | pnpm | yarn | bun
  }
}
```

Env injection is per-agent-run only (not global). Token cost: ~195 chars base + ~97 per skill (~24 tokens each). Skills snapshot at session start; watcher auto-refreshes on changes.

**ClawHub**: `clawhub install <slug>`, `clawhub update --all`, `clawhub sync --all`. Browse: https://clawhub.com

**Installers**: `brew`, `node`, `go`, `uv`, `download`. Node respects `skills.install.nodeManager`.

## Hooks System

Event-driven TypeScript handlers running inside Gateway. Distinct from skills (prompt injection) and webhooks (external HTTP).

**HOOK.md format**:
```yaml
---
name: hook-id
description: "What it does"
metadata:
  openclaw:
    events: ["command:new", "message:received"]
    requires:
      bins: ["node"]
      env: ["MY_VAR"]
    emoji: "..."
    export: "default"
---
```

**Events**:

| Event | Trigger |
|-------|---------|
| `command:new` | New session started |
| `command:reset` | Session reset |
| `command:stop` | Session stopped |
| `agent:bootstrap` | Pre-injection (handlers can mutate bootstrap files) |
| `gateway:startup` | After channels load |
| `message:received` | Inbound message |
| `message:sent` | Outbound message |
| `tool_result_persist` | Synchronous tool result transformation |

**Handler** (`handler.ts`):
```typescript
const handler = async (event) => {
  if (event.type !== "command" || event.action !== "new") return;
  // event.messages.push("notification text");
  // event.context: { sessionEntry, workspaceDir, from, to, content }
};
export default handler;
```

**Discovery** (high → low): workspace (`<workspace>/hooks/`) → managed (`~/.openclaw/hooks/`) → bundled.

**Bundled hooks**: `session-memory` (saves context snapshots), `bootstrap-extra-files` (inject files via glob), `command-logger` (JSONL logging), `boot-md` (execute BOOT.md on startup).

**Hook packs**: npm packages with `"openclaw": { "hooks": [...] }`. Install: `openclaw hooks install <spec>`.

**CLI**: `openclaw hooks list [--eligible --verbose --json]`, `info`, `check`, `enable`, `disable`, `install`.

## Tool Access Control

**Profiles**: `minimal` (conversation only), `coding` (+ exec, fs, process), `messaging` (+ message, channel), `full` (all).

**Allow/deny**: Case-insensitive, wildcard support. `deny` wins over `allow`.
```jsonc
{ "tools": { "profile": "coding", "allow": ["browser*"], "deny": ["exec"], "byProvider": {} } }
```

**Groups**: `group:fs`, `group:runtime`, `group:sessions`, `group:web`, `group:ui`, `group:automation`.

**Loop detection**: `genericRepeat`, `knownPollNoProgress`, `pingPong`. Configurable warning/critical thresholds.

## Messaging & Sub-Agents

**`message` tool**: Unified cross-channel messaging. Actions: `send`, `react`, `edit`, `delete`, `pin`, `unpin`, `poll`, `thread-create`, `thread-reply`, `search`. Supports 9 channels.

**`sessions_spawn`**: Sub-agent runs. One-shot or persistent, thread-bound. Returns run ID immediately. Results announce back to requester.
- Nested spawning via `maxSpawnDepth` (1-5). Depth-1 = orchestrator, depth-2+ = leaf (no session tools).
- Config: `subagents.maxConcurrent` (8), `runTimeoutSeconds` (900), `model`, `thinking`.
- Slash commands: `/subagents list|kill|log|info|send|steer`, `/focus`, `/unfocus`.

**`canvas`**: HTML display on connected nodes (macOS/iOS/Android). Actions: `present`, `hide`, `navigate`, `eval`, `snapshot`.
