# Bun Runtime — Claude Agent SDK

The TypeScript SDK bundles a native Claude Code binary (since v0.2.113). When your host process runs on Node.js or Deno, the SDK spawns this binary under the same runtime by default. Several capabilities depend on running the CLI under Bun specifically.

## The `executable` Option

Control which JavaScript runtime spawns the CLI subprocess:

| Value | Description |
|---|---|
| `'bun'` | Spawn with Bun (required for fast mode; recommended in Bun apps) |
| `'node'` | Spawn with Node.js |
| `'deno'` | Spawn with Deno |
| auto | SDK detects from the host process runtime |

```typescript
for await (const msg of query({
  prompt: "...",
  options: { executable: 'bun' }
})) { /* ... */ }
```

## Fast Mode

Fast mode (research preview) requires the native Bun binary. When the SDK defaults to Node.js, fast mode is silently unavailable.

To enable it:
1. Install Bun on the host
2. Set `executable: 'bun'`
3. Configure fast mode via your model settings

Tracked in [issue #216](https://github.com/anthropics/claude-agent-sdk-typescript/issues/216) (open as of July 2026).

## `ReferenceError: Bun is not defined`

Before v0.2.113 the SDK shipped a bundled JavaScript CLI. When Node.js spawned it, unguarded `Bun.which(…)` calls crashed with `ReferenceError: Bun is not defined` — no stderr output, exit code 1 only.

- Partially fixed in v0.2.51 (critical paths guarded)
- Fully eliminated in v0.2.113 (switched to native binary; the bundled JS no longer ships)

On v0.2.113+, this error shouldn't appear. If you still see it, set `executable: 'bun'` as a workaround. Tracked in [issue #266](https://github.com/anthropics/claude-agent-sdk-typescript/issues/266) (closed).

## `bun build --compile` — Single-binary Apps

When you compile a TypeScript app with `bun build --compile`, Bun embeds all dependencies inside the resulting binary via `Bun.embeddedFiles`. The native Claude Code binary (an optional npm package dependency) gets embedded, but standard path resolution can't find it at runtime inside the compiled binary.

SDK ≥ v0.3.144 provides a workaround:

```typescript
import {
  extractFromBunfs,
  pathToClaudeCodeExecutable
} from "@anthropic-ai/claude-agent-sdk";

// Call once at process startup, before any query() calls
await extractFromBunfs();

// SDK uses the extracted path automatically.
// Or pass it explicitly:
const options = { pathToClaudeCodeExecutable };
```

## Serverless Deployments

The native binary is approximately 230 MB. AWS Lambda and Vercel Functions impose a 250 MB unzipped function size cap, which the SDK's binary alone nearly reaches. The TypeScript SDK is generally not viable for serverless deployments — use a long-running container instead.

See [issue #329](https://github.com/anthropics/claude-agent-sdk-typescript/issues/329) for discussion.
