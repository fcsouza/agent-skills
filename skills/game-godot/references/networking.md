# Networking: a Godot client for the Bun server

Checked against Godot 4.7.2-stable, the 4.7 documentation, Better Auth's docs and the pack's `game-backend-architecture` server, 2026-11-14. The server, its message protocol and its tick loop belong to `game-backend-architecture`; this file covers only the Godot end.

## Origin and native builds

- Godot 4.7.2's native WebSocket client builds its handshake from `Host`, `Upgrade`, `Connection`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version`, an optional `Sec-WebSocket-Protocol`, and whatever is in `handshake_headers`. It sends no `Origin` (`modules/websocket/wsl_peer.cpp` at the 4.7.2-stable tag). A web export sends the page's origin, because the browser opens the socket.
- RFC 6455 says a non-browser host can send any `Origin` it likes. The `Origin` check stops other web pages from using a logged-in player's browser; an `Origin` set by a native client proves nothing. For native clients, security rests on the bearer token.
- The upgrade check in `game-backend-architecture` therefore accepts a request with no `Origin` when it carries `Authorization: Bearer` and `getSession` returns a session. A request with an untrusted `Origin` is still refused, and so is one with neither a trusted `Origin` nor a valid bearer session.
- Native builds send the bearer token and no `Origin`. Do not copy a trusted web origin into a native build.

## Authentication per platform

`betterauth-integration` validates the Better Auth session once, from the upgrade request's headers, and keeps the player id on the socket. RFC 6455 leaves client authentication to the server and names cookies and HTTP authentication as options. What a Godot client can put in that request depends on the platform.

| Platform | What it can send | Option | Works with the pack's server? |
|---|---|---|---|
| Web export, page on the same site as the auth server | The browser's own WebSocket: no custom headers (`handshake_headers` is "not supported in Web exports"), but cookies go with the request | Session cookie | Yes, as is |
| Web export on another site (store, portal) | Same, but the session cookie is cross-site | Better Auth one-time token in the URL | Needs a server change |
| Native (desktop, Android, iOS) | Any header through `handshake_headers` | `Authorization: Bearer` with Better Auth's bearer plugin, no `Origin` | Yes, with the bearer plugin enabled on the Better Auth instance |

### Web, same site: the cookie

- The WebSocket standard opens the connection with the request's credentials mode set to `include`, so the browser attaches the cookies it holds for the server's site.
- Whether a cross-site request carries a cookie depends on its `SameSite` attribute. MDN: `Strict` and `Lax` cookies go only with same-site requests (`Lax` adds top-level navigations), and some browsers apply `Lax` when no attribute is set. Better Auth's cookie page does not state the default it sets, so check the `Set-Cookie` header your server sends.
- So: serve the exported game from the same site as the auth server (for example `play.example.com` and `api.example.com`), sign the player in on the hosting page with Better Auth's web client, then start the game and call `connect_to_url("wss://api.example.com/ws")`. Add the game page's origin to the trusted origins. Signing in on the page rather than from Godot is this skill's rule: no Godot page says whether a web export's HTTP requests carry cookies. Better Auth's `crossSubDomainCookies` option shares the cookie across subdomains; its docs say to enable it only when needed and with the narrowest domain.
- Use `wss://` and the hostname on the TLS certificate. The Godot docs warn that `ws://` from an HTTPS page triggers mixed-content errors and that an IP address will not match the certificate.

### Web, another site: a one-time token

When the game page is on a portal, the session cookie is cross-site and a `Lax` or `Strict` cookie does not travel. Better Auth documents its one-time-token plugin as single-use session tokens for cross-domain authentication: a token tied to the current session, valid 3 minutes by default (`expiresIn`, in minutes), turned back into the session on the server with `auth.api.verifyOneTimeToken({ body: { token } })`. Carrying it in the WebSocket URL is this skill's inference; Better Auth's page does not describe WebSockets.

- Not run for this skill. How a web export on a portal gets a session to ask for the token with is not covered by any page opened; the bearer route below needs CORS to expose `set-auth-token`, which was not checked.
- The client asks for a token over HTTP with its session, then connects to `wss://api.example.com/ws?token=<one-time token>`.
- Godot's HTTP docs advise against credentials in GET URL parameters. Put only the short-lived one-time token in the URL, never the session or bearer token (this skill's rule).
- HTTP calls from a web export to another origin need CORS headers on the server (Godot's HTTPClient note).
- Server change: the upgrade check must read `token` from the URL, verify it with `verifyOneTimeToken`, and refuse the upgrade when verification fails (expired, already used, unknown). Add the portal's origin to the trusted origins.
- The server and any proxy in front of it must keep the `?token=` query string out of access and proxy logs (this skill's rule): the token is short-lived, but a logged URL still exposes it inside its window.
- Ask for these changes in `game-backend-architecture`; do not fork the server code in the Godot project.

### Native: bearer token

- Better Auth's bearer plugin returns a token in the `set-auth-token` response header after sign-in, and `getSession` then accepts `Authorization: Bearer <token>`. Its docs warn to use it only for clients that cannot use cookies, which a native Godot build is.
- Sign in with `HTTPRequest` and read `set-auth-token` from the response headers.
- Where the token lives (this skill's rule): in memory for the session. If the player should stay signed in across restarts, in a file under `user://`, the writable user-data path. Never in `res://` or the export, never in a URL, never in a log or `print()`. Anyone with access to the player's files can read a token stored this way; sign-out should delete the file and revoke the session.

```gdscript
# Godot 4.7.2, native builds only. Each entry is one full header line:
# the engine appends each one to the handshake as written. No Origin:
# the server accepts a native upgrade on the bearer session alone.
socket.handshake_headers = PackedStringArray([
	"Authorization: Bearer " + bearer_token,
])
var err := socket.connect_to_url("wss://api.example.com/ws")
```

Options that no page opened for this skill supports (first-message authentication, a token in `Sec-WebSocket-Protocol`) are left out. The pack authenticates on the upgrade, and the player id never comes from a message.

## The client loop

`WebSocketPeer` is an RFC 6455 client. `connect_to_url()` returns `OK` before the socket connects; nothing happens until `poll()` runs, so call it every frame. Check `get_ready_state()`, drain `get_available_packet_count()` with `get_packet()`, send JSON with `send_text()` (the docs prefer text frames for JSON APIs). For a clean close, keep polling until `STATE_CLOSED`.

```gdscript
# net_client.gd, Godot 4.7.2. Speaks the JSON protocol of
# game-backend-architecture (client: join_room, action, ping;
# server: connected, room_joined, state_update, pong, ...).
extends Node

signal message_received(msg: Dictionary)

@export var server_url := "wss://api.example.com/ws"
var socket := WebSocketPeer.new()

func _ready() -> void:
	# Default buffers are 65535 bytes; size them for your largest message.
	socket.inbound_buffer_size = 1 << 20
	if socket.connect_to_url(server_url) != OK:
		push_error("Unable to connect")
		set_process(false)

func _process(_delta: float) -> void:
	socket.poll()
	var state := socket.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		while socket.get_available_packet_count() > 0:
			var msg = JSON.parse_string(socket.get_packet().get_string_from_utf8())
			if msg is Dictionary:
				message_received.emit(msg)
	elif state == WebSocketPeer.STATE_CLOSED:
		print("closed ", socket.get_close_code(), " ", socket.get_close_reason())
		set_process(false)  # reconnect from here; the server resends full state

func send_message(msg: Dictionary) -> void:
	if socket.get_ready_state() == WebSocketPeer.STATE_OPEN:
		socket.send_text(JSON.stringify(msg))

func _exit_tree() -> void:
	socket.close()
```

- Set buffer sizes before `connect_to_url()` (this skill's rule). `inbound_buffer_size` is roughly the most memory allocated for inbound packets; `max_queued_packets` (4096) caps both queues.
- Every JSON number arrives as a float: convert ticks and counts with `int(msg.tick)`. See `saves-and-data.md`.
- The pack's `ping` and `pong` messages are the heartbeat. `heartbeat_interval` sends protocol pings on native builds but has no effect on the web, and defaults to 0 (off).
- `get_connected_host()` and `get_connected_port()` do not exist on the web.
- Android: enable the `INTERNET` permission in the export preset.
- `godotengine/godot-demo-projects` (9,794 stars, MIT, checked 2026-11-14) has `networking/websocket_minimal`, `websocket_chat` and `websocket_multiplayer`; the minimal client follows the same loop.

## Where game-state-sync hooks in

`game-state-sync` owns the method: prediction with sequence numbers, reconciliation, a snapshot buffer rendered a fixed delay behind the newest snapshot, and correction smoothing. Its boilerplate is TypeScript, so a GDScript client reimplements the same steps; port the logic, keep the numbers (this skill's rule).

- **Merge deltas first.** The pack's server sends only the changed top-level keys in `state_update`, with removed keys as `null`, and a full state in `room_joined`. Apply each delta to your copy of the full state (`erase` on `null`), then store a deep copy (`duplicate(true)`) as the snapshot for that tick.
- **Fixed-step prediction.** The pack's ticks run at the server's rate, 20 per second by default. Run them from your own accumulator, as `ClientGameLoop` does (fixed `dt`, 250 ms cap per frame), and do not set `physics_ticks_per_second` to 20: the Engine reference warns physics can break down below about 30 ticks per second. If you do make one game tick equal one physics tick, `Engine.get_physics_interpolation_fraction()` gives the render alpha in `_process` (this skill's rule, from those two facts).
- **Remote entities** interpolate in `_process`, once per rendered frame. Measure time with `Time.get_ticks_msec()`, which is monotonic; the `_from_system` clocks can be changed by the user.
- **Physics interpolation** smooths nodes between physics ticks and rendered frames. It knows nothing about server snapshots and does not replace the snapshot buffer (this skill's rule).

```gdscript
# Snapshot bracket, Godot 4.7.2. snapshots: Array of {tick: int, state: Dictionary},
# oldest first, filled after each merged state_update. render_tick comes from
# your clock sync (game-state-sync): estimated server tick minus the delay.
var snapshots: Array[Dictionary] = []

func push_snapshot(tick: int, full_state: Dictionary) -> void:
	snapshots.append({"tick": tick, "state": full_state.duplicate(true)})
	if snapshots.size() > 32:
		snapshots.pop_front()

func lerp_x(entity_id: String, render_tick: float) -> Variant:
	for i in range(snapshots.size() - 1, 0, -1):
		var a: Dictionary = snapshots[i - 1]
		var b: Dictionary = snapshots[i]
		if a.tick <= render_tick and render_tick <= b.tick:
			var pa = a.state.players.get(entity_id)
			var pb = b.state.players.get(entity_id)
			if pa == null or pb == null:
				return null
			var alpha: float = (render_tick - a.tick) / float(b.tick - a.tick)
			return lerpf(pa.x, pb.x, alpha)
	return null  # outside the buffer: hold or extrapolate per game-state-sync
```

The `players`, `x` shape matches the example state in `game-state-sync`; use your own state shape.
