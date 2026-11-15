// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325 (2026-11-15)
// Headless agent for CI: explicit tool allowlist, no prompts, hard caps, no inherited settings.
import { query } from '@anthropic-ai/claude-agent-sdk';

export async function runCiAgent(task: string, cwd: string) {
  for await (const message of query({
    prompt: task,
    options: {
      cwd,
      allowedTools: ['Read', 'Glob', 'Grep', 'Edit'],
      // dontAsk turns every prompt into a denial, so a call that would need approval fails instead
      // of hanging. Calls that need none in default mode (reads in cwd, read-only Bash) still run.
      permissionMode: 'dontAsk',
      // Never read the runner's user or project settings in CI.
      settingSources: [],
      maxTurns: 30,
      maxBudgetUsd: 5,
    },
  })) {
    if (message.type !== 'result') continue;
    if (message.subtype === 'success') return message.result;
    // error_max_turns, error_max_budget_usd, error_during_execution, ...
    throw new Error(`agent stopped: ${message.subtype} (session ${message.session_id})`);
  }
  throw new Error('query ended without a result message');
}
