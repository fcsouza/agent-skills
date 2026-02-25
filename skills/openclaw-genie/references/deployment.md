# OpenClaw Deployment Reference

## Installation Methods

### One-Liner (macOS/Linux)
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### npm (all platforms, requires Node 22+)
```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

### Git (hackable)
```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
cd openclaw && pnpm install && pnpm run build
```

### Nix
```bash
nix-env -iA nixpkgs.openclaw
```

### macOS Companion App
Beta menubar application (macOS 14+, Universal Binary).

### Platform Notes
- **macOS**: npm, Nix, or Homebrew.
- **Linux**: npm, Nix, Docker, or Ansible.
- **Windows**: Node.js on WSL2 recommended. Native Windows has limited support.

## Local Service

### macOS (launchd)
```bash
openclaw gateway install     # Creates LaunchAgent ai.openclaw.gateway
openclaw gateway start/stop/restart/uninstall/status
```

### Linux (systemd user-level, recommended)
```bash
openclaw gateway install
sudo loginctl enable-linger $(whoami)  # Enable lingering
systemctl --user enable --now openclaw-gateway
```

### Linux (system-wide)
```bash
sudo openclaw gateway install --system
sudo systemctl enable --now openclaw-gateway
```

### Manual Foreground
```bash
openclaw gateway --port 18789 --verbose
```

## Docker

### Automated Setup
```bash
./docker-setup.sh  # Build, onboard, compose up, generate token
```

### Manual Setup
```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

### docker-compose.yml
Two services: `openclaw-gateway` (ports 18789, 18790) and `openclaw-cli` (interactive).
Volumes: `~/.openclaw/` (config, sessions, auth), workspace directory.

### Dockerfile Details
- Base: `node:22-bookworm`. Runs as non-root `node` user (uid 1000).
- Optional Chromium: `--build-arg OPENCLAW_INSTALL_BROWSER=1` (+300MB).
- Default CMD: `node openclaw.mjs gateway --allow-unconfigured`.

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `OPENCLAW_DOCKER_APT_PACKAGES` | Extra apt packages at build |
| `OPENCLAW_EXTRA_MOUNTS` | Bind mounts (`source:target[:options]`) |
| `OPENCLAW_HOME_VOLUME` | Named volume for `/home/node` |
| `PLAYWRIGHT_BROWSERS_PATH` | Browser cache location |
| API keys | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. |

### Channel Setup in Docker
```bash
docker compose run --rm openclaw-cli channels login                    # WhatsApp QR
docker compose run --rm openclaw-cli channels add --channel telegram --token "..."
docker compose run --rm openclaw-cli channels add --channel discord --token "..."
```

### Permissions
Container runs as uid 1000. Fix host: `sudo chown -R 1000:1000 ~/.openclaw`.

## Agent Sandboxing

Isolate agent execution in Docker containers for untrusted sessions.

```jsonc
{
  "sandbox": {
    "mode": "non-main",           // off | non-main | all
    "scope": "session",           // session | agent | shared
    "workspaceAccess": "none",    // none | ro | rw
    "docker": {
      "network": "none",
      "readOnlyRoot": false,
      "user": "1000:1000",
      "memory": "1g", "cpus": "1",
      "pidsLimit": 100,
      "seccompProfile": "", "apparmorProfile": "",
      "setupCommand": "apt-get update && apt-get install -y git"
    }
  }
}
```

**Sandbox images**: `sandbox-setup.sh` (bookworm-slim), `sandbox-common-setup.sh` (+ Node/Go/Rust), `sandbox-browser-setup.sh` (+ Chromium/noVNC). Corresponding Dockerfiles: `Dockerfile.sandbox`, `Dockerfile.sandbox-common`, `Dockerfile.sandbox-browser`.

**Default tool allow in sandbox**: exec, process, read, write, edit, sessions_list/history/send/spawn.
**Default tool deny in sandbox**: browser, canvas, nodes, cron, discord, gateway. Deny wins.

**Key rule**: If sandboxing is off and `host=sandbox` is requested, exec **fails closed** (won't silently run on gateway).

## Cloud Platforms

### Fly.io
```bash
fly apps create my-openclaw
fly volumes create openclaw_data --size 1 --region iad
fly secrets set OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```
Config: `OPENCLAW_STATE_DIR=/data`, `NODE_OPTIONS=--max-old-space-size=1536`, `node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan`. VM: `shared-cpu-2x`, 2048MB minimum.

### Railway
Required env: `SETUP_PASSWORD`, `PORT=8080`. Recommended: `OPENCLAW_STATE_DIR=/data/.openclaw`, `OPENCLAW_WORKSPACE_DIR=/data/workspace`. Volume at `/data`. Access setup wizard at `https://<domain>/setup`.

### Render
Deploy via `render.yaml`. Persistent disk for `~/.openclaw`.

### General Cloud Guidelines
- Always use persistent storage for `~/.openclaw` (sessions, memory, WhatsApp auth)
- API keys as secrets/env vars, never in config files
- Use Tailscale/VPN for secure access (preferred over public exposure)
- Consider `--bind lan` for non-loopback environments

## Remote Access

**Preferred**: Tailscale/VPN — gateway accessible at Tailscale IP:18789.
**Fallback**: SSH tunnel: `ssh -N -L 18789:127.0.0.1:18789 user@host`.
**DNS discovery**: `openclaw dns setup` (CoreDNS + Tailscale).

## Multiple Instances

```bash
OPENCLAW_HOME=~/.openclaw-2 openclaw gateway --port 18790
# Or named profiles:
openclaw --profile work gateway start
openclaw --profile personal gateway start
```
Each needs unique: port, config path, state directory.

## Security

- **`openclaw doctor`**: Audits file permissions (600 for config, 700 for directory).
- **`openclaw security audit [--deep --fix]`**: Checks inbound access, tool blast radius, network exposure, browser control, disk hygiene, policy drift.
- **Gateway auth**: `token`, `password`, or `trusted-proxy`. Fail-closed if not configured on non-loopback.
- **mDNS**: `discovery.mdns.mode: "off"` to disable Bonjour broadcast.
- **Ansible**: `openclaw-ansible` repo for automated hardened install with Tailscale, UFW, Docker isolation.
