// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325 (2026-11-15)
// Entry for `bun build --compile`. Match the platform package to --target.
import binPath from '@anthropic-ai/claude-agent-sdk-darwin-arm64/claude' with { type: 'file' };
import { query } from '@anthropic-ai/claude-agent-sdk';
import { extractFromBunfs } from '@anthropic-ai/claude-agent-sdk/extract';

// Synchronous. Returns the input path unchanged outside a compiled executable.
const cliPath = extractFromBunfs(binPath);

for await (const message of query({
  prompt: 'Hello',
  options: { pathToClaudeCodeExecutable: cliPath },
})) {
  if (message.type === 'result') console.log(message.subtype);
}
