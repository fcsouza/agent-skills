# Architecture diagrams

Two flows the boilerplate implements, drawn out. `SKILL.md` has the rules.

## Connection and action flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as server.ts
    participant RM as RoomManager
    participant GL as GameLoop (per room)

    C->>S: GET /ws (upgrade, cookie, Origin)
    S->>S: derive: Origin trusted? else 403
    S->>S: derive: auth.api.getSession, else 401
    S-->>C: { type: "connected", playerId }

    C->>S: { type: "join_room", roomId }
    S->>RM: joinRoom(roomId, playerId, ws)
    RM->>GL: start() on first player
    RM-->>C: { type: "room_joined", gameState, tick }

    C->>S: { type: "action", roomId, action }
    S->>RM: queueAction (dropped if not a member)

    Note over GL: next tick
    GL->>RM: tickRoom(dt)
    RM->>RM: drain queue, validate, apply
    RM-->>C: action_result to the actor
    RM-->>C: state_update (delta) to all members
```

## Room lifecycle

```mermaid
stateDiagram-v2
    [*] --> created: createRoom (POST /rooms)
    created --> active: first player joins, loop starts
    active --> closing: last player leaves, or closeRoom
    closing --> closed: loop stopped, players notified and removed
    closed --> [*]: deleted after a 5 s grace period
```

Persist the final state in the `closing` step (the hook is a comment in `beginCloseRoom`), not inside a tick.
