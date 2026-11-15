// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325, zod 4 (2026-11-15)
// A PreToolUse hook that blocks writes to .env files, and an in-process custom tool.
import {
  createSdkMcpServer,
  query,
  tool,
  type HookCallback,
} from '@anthropic-ai/claude-agent-sdk';
import { lstatSync, readlinkSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { z } from 'zod';

// Matches .env, .env.local, .ENV.production and so on.
const ENV_FILE = /^\.env(\..+)?$/i;

// True if the path, or any symlink hop it leads through, names an .env file. A dangling link
// (`ln -s .env config`) is followed with readlink, so a write through it is still caught.
// Windows stream suffixes (":x") and trailing dots and spaces are stripped from each name.
// Throws on a link loop, which the caller treats as a denial.
export function hitsEnvFile(filePath: string, cwd: string) {
  let path = resolve(cwd, filePath);
  for (let hops = 0; ; hops++) {
    if (ENV_FILE.test(basename(path).split(':')[0].replace(/[. ]+$/, ''))) return true;
    if (!lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) return false;
    if (hops >= 40) throw new Error('too many symlinks');
    path = resolve(dirname(path), readlinkSync(path));
  }
}

export const blockEnvWrites: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PreToolUse') return {};
  // Fail closed: a missing or non-string path, or any error while resolving it, is a denial.
  let denied = true;
  try {
    const { file_path: filePath } = input.tool_input as { file_path?: unknown };
    if (typeof filePath === 'string' && filePath !== '') {
      denied = hitsEnvFile(filePath, input.cwd);
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
