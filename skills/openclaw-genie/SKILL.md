---
name: openclaw-genie
description: >-
  Covers installing, configuring, securing and deploying OpenClaw, the self-hosted AI assistant gateway, by sending the agent to the official docs. Use when a task involves OpenClaw: installing it, editing openclaw.json, storing tokens as secrets, connecting a chat channel, exposing the gateway beyond localhost, or running it in Docker or on a VPS.
---

# OpenClaw Genie

OpenClaw changes fast, and its docs are the only source that stays current. This skill holds the decisions and the safety rules. It does not restate the CLI, the config keys or the channel list.

## Read the docs first

OpenClaw publishes its docs for agents: an index at `https://docs.openclaw.ai/llms.txt`, and every page as Markdown when you add `.md` to its URL. I found no official OpenClaw MCP server or agent skill for operating it.

1. Fetch `https://docs.openclaw.ai/llms.txt`.
2. Fetch the page you need, for example `https://docs.openclaw.ai/install.md`.
3. Run `openclaw --version` before you trust a key name. A page may describe a newer release than the one installed.

Do not quote a version, a channel count or a model id from memory. Read it from the page.

## Install

- Read the Node requirement from `npm view openclaw engines` and `https://docs.openclaw.ai/install.md`. Do not rely on a version you remember.
- Prefer the package manager: `npm install -g openclaw@latest`, then `openclaw onboard --install-daemon`. The install page lists an extra npm flag for some npm versions. Read it.
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
- The docs suggest Telegram first. `openclaw channels add --channel telegram --use-env` takes the token from the environment. A `--token <bot-token>` flag also exists, but it puts the token in shell history.
- For iMessage the docs prefer the native `imsg` channel for new setups.
- An "external plugin" is maintained outside the OpenClaw repo. Tell the user before you install one.
- Set who may message the bot (DM pairing or an allowlist) before you connect a channel to an agent that has tools. See `https://docs.openclaw.ai/gateway/security/access-control.md`.

## Exposure and security

The docs' threat model says the assistant can run arbitrary shell commands, read and write files, and send messages. Browser control gives the model a real browser. Whoever reaches the gateway with valid auth gets that power. Treat the gateway as a control plane.

- Keep `gateway.bind` at `"loopback"`. For remote access prefer an SSH tunnel or Tailscale Serve.
- Do not set `bind` to `lan`, `tailnet`, `custom` or `0.0.0.0` unless gateway auth (token, password or a correctly set up trusted proxy) is on and a firewall limits the source addresses. Tell the user that this gives the reachable party shell and browser control. Work through `https://docs.openclaw.ai/gateway/security/exposure-runbook.md` first.
- Do not port-forward the gateway or put it on the public internet without an identity-aware proxy.
- Docker bypasses UFW. A published port (`-p` or Compose `ports:`) routes around host `INPUT` rules, so a UFW deny does not protect it. Enforce the rule in the `DOCKER-USER` chain. The rules are in `https://docs.openclaw.ai/gateway/security/network-exposure.md`. Verify with a port scan from outside.
- Leave every `dangerously*` config key unset. Do not enable one to clear an error.
- Do not point browser control at a profile that holds logged-in sessions the agent should not use.
- Run `openclaw security audit` and fix what it reports. Add `--deep` for live gateway checks.

## Deployment

- Docker: follow `https://docs.openclaw.ai/install/docker.md`. The setup script is `scripts/docker/setup.sh` in the repo.
- Cloud hosts (Fly.io, Hetzner, GCP and others) each have a page under `https://docs.openclaw.ai/install/`. Find it in `llms.txt`. Keep secrets in the host's secret store, not on a command line.
- Back up `~/.openclaw` before an upgrade or migration. See `https://docs.openclaw.ai/install/backups.md`.

## Pitfalls

- Answering from a remembered config schema. Fetch the page and check `openclaw --version`.
- Writing a bot token into `openclaw.json`, `.env` or shell history.
- Binding to the LAN "just to test" and leaving it.
- Trusting UFW for a Docker-published port.
- Installing an external plugin without telling the user.
- Quoting a model id or tool-profile default from memory. Read the page.

## Files

- `references/sources.md`: read when you need the official page behind a claim in this skill before you repeat it.

## Related skills

None.
