# OpenClaw Genie

An agent skill for [OpenClaw](https://openclaw.ai), the self-hosted AI assistant gateway. It does not copy the OpenClaw docs. It sends the agent to `https://docs.openclaw.ai/llms.txt` and the `.md` pages, and it holds the safety rules an agent needs when it installs, configures or exposes a gateway.

## What it covers

- Installing on the Node version the package requires, without piping an unverified script to bash
- Secrets through SecretRef, not plaintext
- Channels as the current docs list them
- Exposing the gateway: loopback by default, auth and a firewall otherwise, and the Docker and UFW bypass
- Deployment: Docker and cloud hosts, by pointing to the docs

## File structure

```
openclaw-genie/
├── SKILL.md
├── evals/evals.json
└── references/sources.md     # the official page behind each claim
```

## Installation

### Via ClawHub (OpenClaw only)

```bash
clawhub install openclaw-genie
```

### Manual

Copy the `openclaw-genie/` folder to your agent's skills directory:

```bash
# OpenClaw (workspace skills, highest precedence)
cp -r openclaw-genie/ ~/.openclaw/workspace/skills/openclaw-genie/

# Claude Code
cp -r openclaw-genie/ .claude/skills/openclaw-genie/
```

## Sources

- [OpenClaw Docs](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [ClawHub Registry](https://clawhub.com)
