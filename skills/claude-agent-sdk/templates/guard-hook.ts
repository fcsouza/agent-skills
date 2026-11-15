// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325, zod 4 (2026-11-15)
// A PreToolUse hook that blocks writes to .env files, and an in-process custom tool.
import {
  createSdkMcpServer,
  query,
  tool,
  type HookCallback,
} from '@anthropic-ai/claude-agent-sdk';
import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';

// Matches .env, .env.local, .ENV.production and so on.
const ENV_FILE = /^\.env(\..+)?$/i;

// Follow symlinks, then drop Windows stream suffixes (":x") and trailing dots and spaces,
// so a link or an alias of .env does not slip past the name check.
function realName(filePath: string) {
  const full = resolve(filePath);
  const real = existsSync(full)
    ? realpathSync(full)
    : join(existsSync(dirname(full)) ? realpathSync(dirname(full)) : dirname(full), basename(full));
  return basename(real).split(':')[0].replace(/[. ]+$/, '');
}

const blockEnvWrites: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};
  const { file_path: filePath } = input.tool_input as { file_path?: string };
  // Fail closed: a write with no path, or a path to any .env* file, is denied.
  if (!filePath || ENV_FILE.test(realName(filePath))) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Writing .env files is not allowed',
      },
    };
  }
  return {};
};

const getTemperature = tool(
  'get_temperature',
  'Get the current temperature for a coordinate',
  { latitude: z.number(), longitude: z.number() },
  async ({ latitude, longitude }) => ({
    // Return isError with your own message. An uncaught throw reaches Claude as the raw exception text.
    content: [{ type: 'text', text: `no data for ${latitude},${longitude}` }],
    isError: true,
  }),
);

const weather = createSdkMcpServer({ name: 'weather', tools: [getTemperature] });

export function run(prompt: string) {
  return query({
    prompt,
    options: {
      mcpServers: { weather },
      // MCP tools are named mcp__<server>__<tool>; list them or they are not auto-approved.
      allowedTools: ['Read', 'Write', 'Edit', 'mcp__weather__*'],
      // This hook only sees Write and Edit. Bash can still write files: leave Bash out of
      // allowedTools, or add a Bash rule, if .env files must stay untouched.
      hooks: { PreToolUse: [{ matcher: 'Write|Edit', hooks: [blockEnvWrites] }] },
    },
  });
}
