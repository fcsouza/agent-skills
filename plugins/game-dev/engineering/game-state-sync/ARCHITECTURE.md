# Game State Sync — Architecture

## Client Prediction + Server Reconciliation

```mermaid
sequenceDiagram
    participant Client
    participant Server

    Note over Client: Tick N — Player presses "move right"

    Client->>Client: Apply input locally (optimistic)
    Client->>Server: Send Input { tick: N, action: moveRight, seq: 42 }

    Note over Client: Tick N+1, N+2... — Client keeps predicting

    Server->>Server: Receive input, validate, apply at tick N
    Server->>Server: Advance authoritative simulation

    Server->>Client: State { tick: N, state: {...}, lastSeq: 42 }

    alt Prediction matches server
        Client->>Client: Discard inputs ≤ seq 42, no correction needed
    else Prediction diverges
        Client->>Client: Rollback to server state at tick N
        Client->>Client: Replay unacknowledged inputs (seq > 42)
        Client->>Client: Resume prediction from corrected state
    end
```

## Delta Compression Pipeline

```mermaid
flowchart LR
    A[Previous State\nTick N-1] --> D[encodeDelta]
    B[Current State\nTick N] --> D
    D --> E{Delta Size\nCheck}
    E -->|< threshold| F[JSON Delta\nSend as-is]
    E -->|> threshold| G[toBinaryDelta\nBinary encode]
    G --> H[Compressed\nUint8Array]

    subgraph Client Receive
        I[Base State] --> J[decodeDelta]
        K[Delta] --> J
        J --> L[Reconstructed\nState]
    end

    F --> K
    H -->|fromBinaryDelta| K
```

## Snapshot Interpolation Timeline

```mermaid
gantt
    title Snapshot Interpolation
    dateFormat X
    axisFormat %s

    section Server Ticks
    Tick 10 (snapshot)    :milestone, 10, 0
    Tick 11               :milestone, 11, 0
    Tick 12               :milestone, 12, 0
    Tick 13 (snapshot)    :milestone, 13, 0
    Tick 14               :milestone, 14, 0
    Tick 15               :milestone, 15, 0
    Tick 16 (snapshot)    :milestone, 16, 0

    section Client Render
    Interpolation buffer  :active, 10, 12
    Render point          :crit, 11, 12
```

```mermaid
flowchart TB
    subgraph Interpolation
        S1[Snapshot A\nTick 10] --> LERP[Interpolate\nalpha = 0.5]
        S2[Snapshot B\nTick 13] --> LERP
        LERP --> R[Render State\nTick ~11.5]
    end

    subgraph Buffer Management
        direction LR
        B1["Buffer[0]: Tick 7"] --> B2["Buffer[1]: Tick 10"]
        B2 --> B3["Buffer[2]: Tick 13"]
        B3 --> B4["Buffer[3]: Tick 16"]
    end

    Note1["Client renders 2 ticks behind\nfor smooth interpolation.\nIf a packet is lost, the buffer\nprovides fallback data."]
```

## Rollback Sequence

```mermaid
sequenceDiagram
    participant Buffer as Rollback Buffer
    participant Engine as Sync Engine
    participant Game as Game Simulation

    Note over Engine: Server correction arrives at Tick 50<br/>Client is at Tick 55

    Engine->>Buffer: rollbackTo(50)
    Buffer-->>Engine: State at Tick 50

    Engine->>Engine: Replace current state with server state

    loop Replay Ticks 51 → 55
        Engine->>Game: step(state, tick)
        Game-->>Engine: Updated state
        Engine->>Buffer: push(tick, state)
    end

    Note over Engine: Client is back at Tick 55<br/>with corrected state

    alt State changed visually
        Engine->>Game: Trigger visual correction<br/>(smooth snap or blend)
    end
```

## Full System Overview

```mermaid
flowchart TB
    subgraph Client
        Input[Player Input] --> Predict[Client Prediction]
        Predict --> LocalState[Local State]
        LocalState --> Render[Interpolation + Render]

        ServerMsg[Server Messages] --> Reconcile[Reconciliation]
        Reconcile --> Rollback[Rollback Buffer]
        Rollback --> Replay[Input Replay]
        Replay --> LocalState
    end

    subgraph Server
        Inputs[All Client Inputs] --> Validate[Validate + Order]
        Validate --> Simulate[Authoritative Simulation]
        Simulate --> Snapshot[Snapshot]
        Snapshot --> DeltaEnc[Delta Encoder]
        DeltaEnc --> Broadcast[Broadcast Deltas]
    end

    Input -->|WebSocket| Validate
    Broadcast -->|WebSocket| ServerMsg
```
