# Architecture Diagrams

## Server Topology

How a single Elysia instance organizes rooms and game loops.

```mermaid
graph TD
    Client1[Client 1] -->|WebSocket| Elysia[Elysia Server]
    Client2[Client 2] -->|WebSocket| Elysia
    Client3[Client 3] -->|WebSocket| Elysia
    Client4[Client 4] -->|REST| Elysia

    Elysia --> WS[WebSocket Handler]
    Elysia --> REST[REST Routes]

    WS --> RM[Room Manager]

    RM --> R1[Room A]
    RM --> R2[Room B]
    RM --> R3[Room C]

    R1 --> GL1[Game Loop 20 TPS]
    R1 --> S1[Game State A]
    R1 --> AQ1[Action Queue A]

    R2 --> GL2[Game Loop 10 TPS]
    R2 --> S2[Game State B]
    R2 --> AQ2[Action Queue B]

    R3 --> GL3[Game Loop 20 TPS]
    R3 --> S3[Game State C]
    R3 --> AQ3[Action Queue C]

    REST --> DB[(PostgreSQL)]
    R1 -.->|Persist on close| DB
    R2 -.->|Persist on close| DB
```

## Message Flow

Complete lifecycle of a player action from client to broadcast.

```mermaid
sequenceDiagram
    participant C as Client
    participant WS as WebSocket Handler
    participant RM as Room Manager
    participant AQ as Action Queue
    participant GL as Game Loop
    participant GS as Game State
    participant BC as Broadcast

    C->>WS: { type: "auth", token: "jwt..." }
    WS->>WS: Verify JWT
    WS-->>C: { type: "auth_success", playerId }

    C->>WS: { type: "join_room", roomId }
    WS->>RM: joinRoom(roomId, playerId, ws)
    RM-->>C: { type: "room_joined", gameState, tick }
    RM->>BC: { type: "player_joined", playerId }
    BC-->>C: Broadcast to room members

    C->>WS: { type: "action", roomId, action }
    WS->>RM: queueAction(roomId, playerId, action)
    RM->>AQ: Push action

    Note over GL: Next tick fires
    GL->>AQ: Drain action queue
    GL->>GS: Validate + apply actions
    GL->>GS: Update game state (dt)
    GL->>BC: Compute delta
    BC-->>C: { type: "state_update", state, tick }
    GS-->>C: { type: "action_result", success }
```

## Room Lifecycle

State transitions for a room from creation to cleanup.

```mermaid
stateDiagram-v2
    [*] --> Created: POST /api/sessions
    Created --> Active: First player joins
    Active --> Active: Players join/leave
    Active --> Closing: Last player leaves OR DELETE /api/sessions/:id
    Closing --> Closed: State persisted + players notified
    Closed --> [*]: Cleanup after grace period

    note right of Created
        Room exists but game loop
        is not yet running
    end note

    note right of Active
        Game loop ticking
        Actions being processed
        State broadcasting
    end note

    note right of Closing
        Game loop stopped
        Final state persisted
        Players notified
    end note
```

## Scaling Pattern

Multiple Elysia instances communicating via Redis pub/sub.

```mermaid
graph TB
    LB[Load Balancer] --> E1[Elysia Instance 1]
    LB --> E2[Elysia Instance 2]
    LB --> E3[Elysia Instance 3]

    E1 --> RM1[Room Manager 1]
    E2 --> RM2[Room Manager 2]
    E3 --> RM3[Room Manager 3]

    RM1 --> R1A[Room A]
    RM1 --> R1B[Room B]
    RM2 --> R2C[Room C]
    RM2 --> R2D[Room D]
    RM3 --> R3E[Room E]

    E1 <-->|pub/sub| Redis[(Redis)]
    E2 <-->|pub/sub| Redis
    E3 <-->|pub/sub| Redis

    Redis <--> PG[(PostgreSQL)]

    subgraph "Cross-Server Communication"
        Redis
    end

    subgraph "Persistent Storage"
        PG
    end
```

### Scaling Flow Detail

```mermaid
sequenceDiagram
    participant C1 as Client on Instance 1
    participant E1 as Elysia Instance 1
    participant Redis as Redis Pub/Sub
    participant E2 as Elysia Instance 2
    participant C2 as Client on Instance 2

    Note over C1,C2: Player 1 (Instance 1) sends message to Player 2 (Instance 2)

    C1->>E1: { type: "action", roomId, action }
    E1->>E1: Process action locally
    E1->>Redis: PUBLISH game:broadcast { channel, data }
    Redis->>E2: MESSAGE game:broadcast { channel, data }
    E2->>C2: Forward to subscribed clients
```

## Data Flow Overview

Where each type of data lives and how it flows.

```mermaid
graph LR
    subgraph "Ephemeral (In-Memory)"
        GS[Game State]
        AQ[Action Queue]
        CONN[Connections Map]
    end

    subgraph "Shared Ephemeral (Redis)"
        PRES[Presence TTL Keys]
        PUBSUB[Pub/Sub Channels]
        CACHE[State Cache]
    end

    subgraph "Persistent (PostgreSQL)"
        PLAYERS[Player Profiles]
        INV[Inventory]
        HISTORY[Match History]
        CONFIG[Room Configs]
    end

    GS -->|Delta sync| PUBSUB
    GS -->|Persist on close| HISTORY
    CONN -->|Heartbeat| PRES
    AQ -->|Drain per tick| GS

    PUBSUB -->|Cross-server| GS
    CACHE -->|Rejoin recovery| GS
    PLAYERS -->|Load on join| GS
```
