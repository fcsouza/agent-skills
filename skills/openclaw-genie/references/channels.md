# OpenClaw Channels Reference

## Native Channels (9)

### Discord
```bash
openclaw config set channels.discord.token '"BOT_TOKEN"' --json
openclaw config set channels.discord.enabled true --json
```
- **Auth**: Bot token + Application ID. Enable Message Content Intent + Server Members Intent.
- **OAuth scopes**: `bot`, `applications.commands`. Permissions: View Channels, Send Messages, Read History, Embed Links, Attach Files.
- **Features**: Guilds, DMs, threads, forum channels, slash commands, voice, Components v2, interactive buttons, select menus, modals.
- **Streaming**: `off`, `partial`, `block`, `progress`. Preview streaming uses send+edit pattern.
- **Routing**: Role-based bindings via `bindings[].match.roles` (role IDs). Evaluate in sequence.
- **Config**: `historyLimit` (20), `dmHistoryLimit`, `replyToMode` (`off`/`first`/`all`), `textChunkLimit`, `status`, `activity`, `activityType` (0-5), `execApprovals.enabled` (button-based), `pluralkit.enabled`.

### Telegram
```bash
openclaw channels add --channel telegram --token "BOT_TOKEN"
# Or: openclaw config set channels.telegram.botToken '"TOKEN"'
```
- **Auth**: Token from @BotFather (`/newbot`). Env fallback: `TELEGRAM_BOT_TOKEN`.
- **Features**: Groups, forum topics, inline buttons, custom commands, webhook mode, reactions.
- **Webhook mode**: Set `webhookUrl` + `webhookSecret`. Default: long polling via grammY.
- **Streaming**: `off` (default), `partial`, `block`, `progress`.
- **Config**: `textChunkLimit` (4000), `chunkMode` (`length`/`newline`), `mediaMaxMb` (5), `linkPreview`, `reactionLevel` (`off`/`ack`/`minimal`/`extensive`), `historyLimit` (50), `dmHistoryLimit`.
- **Privacy**: Disable via BotFather `/setprivacy` for full group visibility. Remove/re-add bot after.
- **Network**: `proxy` (SOCKS/HTTP), `network.dnsResultOrder` (`ipv4first`/`verbatim`).

### WhatsApp
```bash
openclaw channels login --channel whatsapp
# Multi-account: openclaw channels login --channel whatsapp --account work
```
- **Auth**: QR code scan from phone. Credentials at `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`.
- **Features**: Media (image, video, audio, documents, stickers), polls, groups, reactions.
- **Access**: E.164 format phone numbers. `allowFrom`, `groupAllowFrom`, `groups` (group allowlist).
- **Group behavior**: Two-layer: group membership allowlist → sender policy. Mention gating: explicit @mention, regex, reply-to-bot.
- **Config**: `textChunkLimit` (4000), `chunkMode`, `mediaMaxMb` (50), `sendReadReceipts`, `ackReaction`.
- **Note**: Requires Node runtime (Bun incompatible). More disk state than other channels.

### Slack
```bash
# Socket mode (recommended):
openclaw config set channels.slack.appToken '"xapp-..."' --json
openclaw config set channels.slack.botToken '"xoxb-..."' --json
# HTTP mode: also set signingSecret, webhookPath
```
- **Modes**: `socket` (default, needs `appToken` with `connections:write`) or `http` (needs `signingSecret`).
- **Scopes**: `chat:write`, `channels:history`, `channels:read`, `groups:history`, `im:history`, `app_mentions:read`, `assistant:write`, `reactions:read/write`, `files:read/write`, `commands`, + more.
- **Native streaming**: Uses `chat.startStream/appendStream/stopStream`. Requires "Agents and AI Apps" enabled + `assistant:write`.
- **Threading**: `thread.historyScope` (`thread`), `thread.inheritParent`, `thread.initialHistoryLimit` (20).
- **Config**: `textChunkLimit` (4000), `chunkMode` (`newline`), `mediaMaxMb` (20), `replyToMode`, slash commands (default off: `commands.native: true`).
- **Note**: `replyToMode="off"` disables ALL reply threading including explicit tags (differs from Telegram).

### Signal
```bash
openclaw channels add signal
# Requires signal-cli installed + registered phone number
```
- **Auth**: signal-cli via JSON-RPC + SSE. `autoStart: true` spawns daemon automatically.
- **Config**: `account` (E.164), `cliPath`, `httpHost`/`httpPort` (127.0.0.1:8080), `startupTimeoutMs` (120000).
- **Access**: Phone numbers or `uuid:<id>`. DM/group allowlists.
- **Features**: Reactions, read receipts, media, groups, typing indicators.

### BlueBubbles (iMessage)
```bash
openclaw channels add bluebubbles --http-url <url> --password <password>
```
- **Auth**: BlueBubbles server on macOS. `serverUrl` + `password`.
- **Features**: Reactions, edits, unsend, reply, group management, media, send effects.
- **Addressing**: `chat_guid:iMessage;-;+15555550123` (preferred), `chat_id:123`, handles.
- **Config**: `webhookPath` (`/bluebubbles-webhook`), `textChunkLimit`, `mediaMaxMb` (8), `mediaLocalRoots`.

### Google Chat, IRC
- **Google Chat**: HTTP webhook app. `openclaw channels add googlechat`.
- **IRC**: `host`, `port`, `tls`, `nick`, `channels[]`. NickServ support. Env vars: `IRC_HOST`, `IRC_PORT`, `IRC_NICK`, etc.

## Plugin Channels

```bash
openclaw plugins install @openclaw/matrix      # E2EE, threads, rooms
openclaw plugins install @openclaw/msteams     # Adaptive Cards, polls
openclaw plugins install @openclaw/<channel>   # mattermost, feishu, line, nostr, etc.
```
Matrix supports encryption (`encryption: true`), auto-join, thread replies. MS Teams supports Adaptive Cards, polls stored locally.

## Access Control (All Channels)

| Policy | Options | Default |
|--------|---------|---------|
| DM | `pairing`, `allowlist`, `open`, `disabled` | `pairing` |
| Group | `open`, `allowlist`, `disabled` | `allowlist` |
| Mention gating | `requireMention: true/false` | `true` for groups |

**Pairing**: 1-hour expiry, max 3 pending per channel. Approve via `openclaw pairing approve <channel> <code>`.
**Per-group overrides**: `requireMention`, `allowFrom`, `skills`, `systemPrompt`, `tools`, `toolsBySender`.
**Multi-account**: `channels.<channel>.accounts.<id>` with per-account overrides for policy, tokens, auth.

## Session Routing

- DMs → agent session per `dmScope` (`main`/`per-peer`/`per-channel-peer`/`per-account-channel-peer`)
- Groups → `agent:<id>:<channel>:group:<groupId>`
- Threads → `:thread:<threadTs>` (Slack/Discord) or `:topic:<topicId>` (Telegram forums)
- Deterministic: replies always return to originating channel
- Thread bindings: 24h TTL, configurable
- `session.identityLinks` maps cross-channel identities to single user
