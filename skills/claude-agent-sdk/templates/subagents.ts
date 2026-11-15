// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325 (2026-11-15)
// Read-only reviewer subagent, with depth and concurrency capped through env vars.
import { query } from '@anthropic-ai/claude-agent-sdk';

export function review(prompt: string) {
  return query({
    prompt,
    options: {
      // Claude delegates through the Agent tool. If you restrict the parent with `tools`,
      // keep Agent in that list.
      allowedTools: ['Read', 'Grep', 'Glob', 'Agent'],
      agents: {
        'code-reviewer': {
          description: 'Reviews code for security and correctness. Use after any code change.',
          prompt: 'Review the code you are pointed at. Report findings with file and line.',
          tools: ['Read', 'Grep', 'Glob'],
          model: 'sonnet',
        },
      },
      // TypeScript replaces the subprocess environment with `env`, so spread process.env.
      env: {
        ...process.env,
        CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1',
        CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '5',
      },
      maxBudgetUsd: 5,
    },
  });
}
