# Bun and the TypeScript SDK

Checked against `@anthropic-ai/claude-agent-sdk` 0.3.325 on 2026-11-15. Sources are in `sources.md`.

## The `executable` option

`executable` is a TypeScript option: `'bun' | 'deno' | 'node'`. The SDK detects the runtime when you leave it out. It does not exist in the Python options (`ClaudeAgentOptions` 0.2.182).

## Single-file executable with `bun build --compile`

Inside a compiled executable `require.resolve` does not work in the `$bunfs` virtual filesystem. Without a fix the SDK throws `Native CLI binary for <platform>-<arch> not found`.

The fix, from SDK 0.3.144:

1. Import the platform binary as a file asset: `import binPath from '@anthropic-ai/claude-agent-sdk-<platform>-<arch>/claude' with { type: 'file' }`. On Windows the subpath is `claude.exe`.
2. Import `extractFromBunfs` from the subpath `@anthropic-ai/claude-agent-sdk/extract`. The package root does not export it.
3. Call `extractFromBunfs(binPath)` once at startup. It is synchronous. It copies the binary to a per-user temp directory and returns the real path. Outside a compiled executable it returns its input unchanged.
4. Pass the result as `pathToClaudeCodeExecutable` in the `query()` options.

Each executable embeds one platform's binary. Match the platform package to `--target`. To cross-compile, install the other platform package, for example `bun add @anthropic-ai/claude-agent-sdk-linux-x64 --force`. Then run `bun build --compile --target=<target>`.

`templates/bun-compile.ts` has the code and `templates/embedded-binary.d.ts` has the type for the binary import. Both typecheck against 0.3.325.

If your package manager skips optional dependencies, the SDK throws the same "binary not found" error. Set `pathToClaudeCodeExecutable` to a separately installed `claude` binary.

## Bundling the SDK

If you bundle the SDK with your own dependencies, the docs describe a `/core` entry (from 0.3.282) that imports `zod` and `@modelcontextprotocol/sdk` from your `node_modules` instead of inlining them. Import from the root or from `/core` in one process, never both. Read the "Import the `/core` entry" section of the TypeScript reference before using it.

## Serverless

The binary is large. Measure the installed platform package against your function size limit. On the machine used for this check, the `darwin-arm64` package was 332 MB installed. A long-running container avoids the limit.
