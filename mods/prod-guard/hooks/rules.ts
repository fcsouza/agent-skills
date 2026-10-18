// Which Dokploy MCP calls only read. Everything else under the server is held:
// a new endpoint that writes is held by default, never let through by default.

export const SERVER = /^mcp__dokploy__/;

const READ_ACTION =
  /-(one|search|all\w*|by[A-Z]\w*|read\w*|get[A-Z]\w*|list\w*|load[A-Z]\w*|preview\w*|fetch\w*|templates|canGenerate\w*|homeStats|onboardingStatus|queueList|validateDomain)$/;

export function isWrite(tool: string): boolean {
  return SERVER.test(tool) && !READ_ACTION.test(tool);
}

/** `mcp__dokploy__application-deploy` → `application-deploy`. */
export const actionOf = (tool: string): string => tool.replace(SERVER, '');

// Fields the engine adds to every call: not the call's own arguments.
const ENGINE_FIELDS = new Set(['tool', 'tool_use_id', 'consent', 'agentId', 'requestMeta', 'signal']);

// Field names whose values never go on screen: env blocks, passwords, tokens.
const SECRET_KEY = /env|password|secret|token|key|credential/i;

/** The call's arguments as short lines, secrets shown by name only. */
export function describeInput(input: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (ENGINE_FIELDS.has(key) || value === undefined || typeof value === 'function') {
      continue;
    }
    if (SECRET_KEY.test(key)) {
      lines.push(`${key}: (hidden${typeof value === 'string' ? `, ${countLines(value)} lines` : ''})`);
      continue;
    }
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    lines.push(`${key}: ${text.length > 120 ? `${text.slice(0, 117)}...` : text}`);
  }
  return lines.slice(0, 12);
}

const countLines = (text: string): number => text.split('\n').filter(line => line.trim() !== '').length;
