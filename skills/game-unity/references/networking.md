# Connecting a Unity client to the Bun server

Checked against Unity 6000.3, NativeWebSocket at commit `bf3280c` (master, 2026-11-14) and the Newtonsoft Json Unity package 3.2.2 on 2026-11-14.

## Why not Unity's netcode

- Netcode for GameObjects runs the authoritative simulation in a Unity game instance: a dedicated server or a listen-server host, both running the package. The pack's server is Bun.
- Unity Transport, under Netcode, carries UDP or WebSockets; on WebGL only client-mode WebSockets work. No Unity page documents its wire format for a non-Unity server.
- This skill's rule: skip Netcode and Unity Transport. Open a plain WebSocket to the server from `game-backend-architecture` and speak its JSON messages.

## Web (WebGL) build limits

- No `System.Net.Sockets`, `System.Net.Http` or `System.Net.WebSockets`: browsers give no direct access to IP sockets. A WebSocket client for Web needs a JavaScript path.
- `UnityWebRequest` runs on the browser's Fetch API, so cross-origin calls need CORS on the server (the server in `game-backend-architecture` already sets CORS for its trusted origins).
- Never block on a request (`while (!www.isDone) {}`): the browser cannot wait synchronously. Use a coroutine or `async`.
- `Application.runInBackground` is false by default, and the application pauses in the background. On Web that stops the loop and the socket callbacks while the tab is hidden.

## Client library: NativeWebSocket

`endel/NativeWebSocket`: 1,749 stars, last push 2026-10-26 (`gh api`, 2026-11-14). Its licence is recorded two ways: the repository's LICENSE file is Apache-2.0, while `integrations/Unity/package.json` (the UPM package you install) says MIT; GitHub's API reports NOASSERTION. Read the licence of the package version you install. The Colyseus Unity SDK uses it.

- It uses `System.Net.WebSockets` on native targets and a JavaScript library on WebGL.
- Install through the Package Manager with the git URL `https://github.com/endel/NativeWebSocket.git#upm-2` (the 1.x line is `#upm`). Do not copy its raw source files: a build step adds the WebGL guards.
- In 2.x, events reach the main thread through `SynchronizationContext`. Do not call `DispatchMessageQueue()` from `Update` as 1.x code does.
- Constructors: `new WebSocket(url)`, `new WebSocket(url, headers)`, and overloads with subprotocols. Events: `OnOpen`, `OnMessage(byte[])`, `OnError`, `OnClose`. Methods: `Connect()`, `Send(byte[])`, `SendText(string)`, `Close()`.
- The headers dictionary is applied on native targets only. In the WebGL integration the constructors accept it and drop it, and the JavaScript side calls `new WebSocket(url, subprotocols)`.

## Authentication, per build

`betterauth-integration` reads the session once, from the upgrade request's headers, and the server in `game-backend-architecture` rejects the upgrade with 403 when `Origin` is missing or not in its trusted list, and with 401 without a session.

| Build | What the handshake can carry | Consequence |
|---|---|---|
| Web (WebGL) | The browser WebSocket API takes only a URL and subprotocols: no `Authorization` or other custom header. The browser adds `Origin` (RFC 6455 requires it from browser clients) and its cookies. | Serve the build from an origin in the server's trusted origins, sign the player in through Better Auth on that site, and let the session cookie authenticate the socket. This skill's rule: keep the build and the server on the same site, because the cookie's SameSite setting decides whether the browser sends it; Better Auth's cookie page does not state the default. |
| Desktop, mobile | `ClientWebSocketOptions.SetRequestHeader` sets any request header; NativeWebSocket passes its header dictionary to it. RFC 6455 lets a non-browser client omit `Origin`; expect none and log the upgrade headers on the server to confirm. | Send `Authorization: Bearer <token>` (the token comes from the sign-in response headers) and an `Origin` from the trusted list. The bearer path needs Better Auth's `bearer()` plugin on the server; Better Auth says to use it only for clients that cannot use cookies. |

Rules (this skill's):

- The `Origin` check protects players' browsers from other sites. A native client can send any header, so its security rests on the session token, not on `Origin`. A leaked token gives full access to that player's account until the session is revoked.
- Store the native token where the platform keeps secrets, never in the save file or `PlayerPrefs`.
- Never put the token in the URL query string: URLs end up in logs.
- Test the header path on each target platform before you rely on it. No Unity page documents which handshake headers each player runtime lets through.

```csharp
// Unity 6000.3, NativeWebSocket bf3280c. Native builds send headers; WebGL ignores them.
using System.Collections.Generic;
using NativeWebSocket;
using UnityEngine;

public class ServerConnection : MonoBehaviour
{
    [SerializeField] string url = "wss://play.example.com/ws";
    [SerializeField] string trustedOrigin = "https://play.example.com";
    WebSocket socket;

    public async void Open(string bearerToken)
    {
        var headers = new Dictionary<string, string>
        {
            { "Origin", trustedOrigin },
            { "Authorization", "Bearer " + bearerToken },
        };
        socket = new WebSocket(url, headers);
        socket.OnMessage += bytes => OnServerMessage(System.Text.Encoding.UTF8.GetString(bytes));
        socket.OnClose += code => Debug.Log("closed: " + code); // resync on reconnect
        await socket.Connect();
    }

    void OnServerMessage(string json) { /* parse, then hand to the sync layer */ }

    async void OnApplicationQuit() { if (socket != null) await socket.Close(); }
}
```

## Parsing server messages

The server sends JSON objects with a `type` field, and its state deltas are free-form objects keyed by entity or field name. `JsonUtility` cannot read them: it serializes fields of `[Serializable]` types only, does not support `Dictionary<>`, and takes no primitives or arrays at the top level.

- Use the Newtonsoft Json Unity package (`com.unity.nuget.newtonsoft-json`, 3.2.2, which corresponds to Newtonsoft.Json 13.0.2). Its LINQ to JSON API reads and writes JSON without a fixed class. It does not appear in the 6000.3 released-packages list; check that the package resolves in your project before you depend on it.
- Read `type` first, then map the payload. Keep fixed-shape messages (join, pong) as `[Serializable]` classes; read deltas as JSON objects.
- Treat every field from the server as untrusted input that can be missing (this skill's rule).

## Where sync hooks into the frame loop

What Unity documents:

- `Update` runs once per rendered frame. `LateUpdate` runs after every `Update` has run.
- `FixedUpdate` runs zero, one or several times per frame, at `Time.fixedDeltaTime` of in-game time, which `Time.timeScale` scales. It drives physics.
- Coroutines that yield `WaitForFixedUpdate` resume at the end of the fixed step; `WaitForEndOfFrame` at the end of the frame.

This skill's rule for `game-state-sync`:

1. Port its fixed-step loop into one `MonoBehaviour`. In `Update`, add `Time.unscaledDeltaTime`, capped at 250 ms per frame as in `game-state-sync`, to an accumulator, run every due prediction tick at the server's tick rate, and keep the leftover fraction as `alpha`. Do not run network ticks in `FixedUpdate`: its rate is the physics step and it follows `timeScale`, while the server's tick does neither.
2. Apply server snapshots in the socket callback (it runs on the main thread): store them by server tick for interpolation and reconcile the local player.
3. In `LateUpdate`, write transforms: the local player between its last two predicted states with `alpha`, remote entities between the two snapshots that bracket the render time.
4. Use Unity physics only for client-side effects. The server owns the result of every simulated interaction.
5. When the app comes back from the background (Web tab hidden, mobile app suspended), do not replay the gap: drop the accumulator and resync with the server, as `game-client` does for browsers.
