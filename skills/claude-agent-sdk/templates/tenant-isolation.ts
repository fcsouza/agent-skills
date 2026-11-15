// Verified against: @anthropic-ai/claude-agent-sdk 0.3.325 (2026-11-15)
// One query per tenant in a shared container: separate cwd, config dir, and no ambient settings.
import { query } from '@anthropic-ai/claude-agent-sdk';

export function runForTenant(prompt: string, tenantDir: string, configDir: string) {
  return query({
    prompt,
    options: {
      cwd: tenantDir,
      settingSources: [],
      env: {
        ...process.env, // keeps PATH and the API key
        CLAUDE_CONFIG_DIR: configDir,
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
      },
    },
  });
}
