// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325, zod 4 (2026-11-15)
// A PreToolUse hook that blocks writes to .env files, and an in-process custom tool.
import {
  createSdkMcpServer,
  query,
  tool,
  type HookCallback,
} from '@anthropic-ai/claude-agent-sdk';
import { basename } from 'node:path';
import { z } from 'zod';

// Matches .env, .env.local, .ENV.production and so on, ignoring a Windows stream suffix (":x")
// and trailing dots or spaces.
const ENV_FILE = /^\.env(\..+)?$/i;

// A policy check on the name the tool asked for. It is not a security boundary: a symlink, or a
// path through a symlinked folder, can still reach an .env file, and so can Bash or a script.
// For a boundary the operating system enforces, run the agent in a sandbox
// (https://code.claude.com/docs/en/sandboxing.md) or under a user that cannot write the file.
export function namesEnvFile(filePath: string) {
  return ENV_FILE.test((basename(filePath).split(':')[0] ?? '').replace(/[. ]+$/, ''));
}

export const blockEnvWrites: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};
  // Fail closed: a missing or non-string path, or any error, is a denial.
  let denied = true;
  try {
    const { file_path: filePath } = input.tool_input as { file_path?: unknown };
    if (typeof filePath === 'string' && filePath !== '') {
      denied = namesEnvFile(filePath);
    }
  } catch {
    denied = true;
  }
  if (denied) {
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
      // This hook only sees Write and Edit. Bash can still write files, and leaving it out of
      // allowedTools does not stop it. Use disallowedTools: ['Bash'] or a Bash hook to block it.
      // onFailure: 'block' denies the call if the callback throws (SDK 0.3.317 or later).
      hooks: {
        PreToolUse: [{ matcher: 'Write|Edit', hooks: [blockEnvWrites], onFailure: 'block' }],
      },
    },
  });
}
