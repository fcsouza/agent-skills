---
name: openclaw-genie
description: >-
  Covers installing, configuring, securing and deploying OpenClaw, the self-hosted AI assistant gateway, by sending the agent to the official docs. Use when a task involves OpenClaw: installing it, editing openclaw.json, storing tokens as secrets, connecting a chat channel, exposing the gateway beyond localhost, or running it in Docker or on a VPS.
---

# OpenClaw Genie

OpenClaw changes fast, and its docs are the only source that stays current. This skill holds the decisions and the safety rules. It does not restate the CLI, the config keys or the channel list.

## Read the docs first

OpenClaw publishes its docs for agents: an index at `https://docs.openclaw.ai/llms.txt`, and every page as Markdown when you add `.md` to its URL. The docs list no MCP server or agent skill for reading the docs or operating OpenClaw. Its `openclaw mcp serve` command is different: it exposes channel conversations to an MCP client (`https://docs.openclaw.ai/cli/mcp/serve.md`). Do not start it without the user's say-so.

1. Fetch `https://docs.openclaw.ai/llms.txt`.
2. Fetch the page you need, for example `https://docs.openclaw.ai/install.md`.
3. Run `openclaw --version` before you trust a key name. A page may describe a newer release than the one installed.

Do not quote a version, a channel count or a model id from memory. Read it from the page.

## Install

- Read the Node requirement from `npm view openclaw engines` and `https://docs.openclaw.ai/install.md`. Do not rely on a version you remember.
- Prefer the package manager: `npm install -g openclaw@latest`, then `openclaw onboard --install-daemon`. On npm 12 and npm 11.16+ add `--allow-scripts=openclaw`, or npm blocks the install scripts. On npm 11.15 and earlier leave the flag out.
- Do not run `curl ... | bash` for `install.sh`. The install page offers it as the fast path but gives no checksum or signature step for the script. If the user wants it, say what it does, give the command, and let them run it.
- After install run `openclaw doctor`, `openclaw gateway status` and `openclaw security audit`.

## Configuration and secrets

- The config file is `~/.openclaw/openclaw.json`. Edit it with `openclaw config get/set/patch/unset`, then run `openclaw config validate`.
- Secrets never go into the file as plaintext, into shell history or onto a command line. Use a SecretRef: `{ source: "env" | "file" | "exec" | "store", provider: "default", id: "..." }`. An env value may be written as `"${VAR}"`. The form `{ "$secret": "NAME" }` is not valid.
- Plaintext stays readable by the agent. After you migrate credentials, run `openclaw secrets audit --check`.
- Set `gateway.auth.mode` explicitly when the gateway token or password is a SecretRef.
- For id rules and provider blocks read `https://docs.openclaw.ai/gateway/secrets.md` and `https://docs.openclaw.ai/gateway/secrets/secretref-contract.md`.

## Channels

- Read `https://docs.openclaw.ai/channels.md`. It is generated and labels each channel as core, bundled plugin, official plugin or external plugin. Do not assume a channel ships in core.
- The docs suggest Telegram first. Run `openclaw channels add --channel telegram --use-env`. It reads `TELEGRAM_BOT_TOKEN` from the environment and does not copy the token into `openclaw.json`. The Gateway service needs the same variable, so keep it in the service's environment (in Docker, the Compose `.env`). Do not use the `--token` flag: it puts the token in shell history.
- For iMessage the docs prefer the native `imsg` channel for new setups.
- An "external plugin" is maintained outside the OpenClaw repo. Tell the user before you install one.
- Set who may message the bot (DM pairing or an allowlist) before you connect a channel to an agent that has tools. See `https://docs.openclaw.ai/gateway/security/access-control.md`.

## Exposure and security

The docs' threat model says the assistant can run arbitrary shell commands, read and write files, and send messages. Browser control gives the model a real browser. Whoever reaches the gateway with valid auth gets that power. Treat the gateway as a control plane.

- Keep `gateway.bind` at `"loopback"`. For remote access prefer an SSH tunnel or Tailscale Serve.
- The `bind` values are `loopback`, `auto`, `lan`, `tailnet` and `custom`. `auto` is the default when the setting is unset in a container, and it resolves to `0.0.0.0`. Do not leave it unset in a container, and do not use `lan`, `tailnet`, `custom` or `auto` unless gateway auth (token, password or a correctly set up trusted proxy) is on and a firewall limits the source addresses. Tell the user that this gives the reachable party shell and browser control. Work through `https://docs.openclaw.ai/gateway/security/exposure-runbook.md` first.
- Do not port-forward the gateway or put it on the public internet without an identity-aware proxy.
- Docker bypasses UFW. A published port (`-p` or Compose `ports:`) routes around host `INPUT` rules, so a UFW deny does not protect it. Enforce the rule in the `DOCKER-USER` chain. The rules are in `https://docs.openclaw.ai/gateway/security/network-exposure.md`. Verify with a port scan from outside.
- Leave every `dangerously*` config key unset. Do not enable one to clear an error.
- Do not point browser control at a profile that holds logged-in sessions the agent should not use.
- Local onboarding sets `tools.profile` to `"full"` when no profile is set (`https://docs.openclaw.ai/gateway/config-tools/tool-policy.md`). For an agent that handles untrusted content (a public group, open DMs), narrow the profile, run it in a sandbox, and deny risky tools such as `gateway`, `cron`, `sessions_spawn` and `sessions_send`. The deny list and sandbox settings are at `https://docs.openclaw.ai/gateway/security/tool-permissions.md`.
- Run `openclaw security audit` and fix what it reports. Add `--deep` for live gateway checks.

## Deployment

- Docker: follow `https://docs.openclaw.ai/install/docker.md`. The setup script is `scripts/docker/setup.sh` in the repo.
- The official Docker flow is open by default. The repo's `docker-compose.yml` publishes `${OPENCLAW_GATEWAY_PORT:-18789}:18789` on all host interfaces, and the setup runs the gateway with `--bind ${OPENCLAW_GATEWAY_BIND:-lan}` (see `https://docs.openclaw.ai/install/docker/networking-and-storage.md`, "LAN vs loopback"). On a public host, change the published port to `127.0.0.1:18789:18789`, or add the `DOCKER-USER` rules before `docker compose up`. Keep `bind` at `lan` inside the container, since the docs say `loopback` makes the published port unreachable. Reach the Control UI over an SSH tunnel or Tailscale.
- Cloud hosts (Fly.io, Hetzner, GCP and others) each have a page under `https://docs.openclaw.ai/install/`. Find it in `llms.txt`. Keep secrets in the host's secret store, not on a command line.
- Back up before an upgrade or migration with `openclaw backup create --verify`. Never copy live `.sqlite`, `-wal`, `-shm` or `-journal` files as a backup. A backup holds auth profiles and channel and provider credentials, so store it like a secret. See `https://docs.openclaw.ai/install/backups.md`.

## Pitfalls

- Answering from a remembered config schema. Fetch the page and check `openclaw --version`.
- Writing a bot token into `openclaw.json` or shell history. A `.env` read through `--use-env` is the documented place, and it must not be committed or world-readable.
- Binding to the LAN "just to test" and leaving it.
- Trusting UFW for a Docker-published port.
- Installing an external plugin without telling the user.
- Quoting a model id from memory. Read `https://docs.openclaw.ai/providers/models.md`.
- Leaving an agent on the `full` tool profile after it faces untrusted senders.

## Files

- `references/sources.md`: read when you need the official page behind a claim in this skill before you repeat it.

## Related skills

None.
