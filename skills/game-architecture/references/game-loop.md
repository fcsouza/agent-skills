# Game Loop Reference

## GameLoop Class

Complete fixed-timestep game loop with speed control, pause/resume, and overflow protection.

```typescript
type TickCallback = (dt: number) => void;

class GameLoop {
  private tickRate: number;
  private tickDuration: number;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId: number | null = null;
  private speedMultiplier = 1;
  private onTick: TickCallback;

  constructor(tickRate: number, onTick: TickCallback) {
    this.tickRate = tickRate;
    this.tickDuration = 1000 / tickRate;
    this.onTick = onTick;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0, multiplier);
  }

  getSpeed() {
    return this.speedMultiplier;
  }

  isRunning() {
    return this.running;
  }

  private loop = (currentTime: number) => {
    if (!this.running) return;

    const deltaTime = (currentTime - this.lastTime) * this.speedMultiplier;
    this.lastTime = currentTime;

    // Overflow protection: cap to 1 second of accumulated time
    this.accumulator += Math.min(deltaTime, 1000);

    while (this.accumulator >= this.tickDuration) {
      this.onTick(this.tickDuration / 1000);
      this.accumulator -= this.tickDuration;
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
```

## Usage

```typescript
const loop = new GameLoop(10, (dt) => {
  resourceSystem.tick(dt);
  upgradeSystem.tick(dt);
  combatSystem.tick(dt);
});

loop.start();
loop.setSpeed(2); // 2x speed
loop.stop();
```

---

## useGameLoop React Hook

Integrates the game loop with React lifecycle and Zustand stores.

```typescript
import { useEffect, useRef } from 'react';

const useGameLoop = (
  tickRate: number,
  onTick: (dt: number) => void,
  enabled = true,
) => {
  const loopRef = useRef<GameLoop | null>(null);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;

    const loop = new GameLoop(tickRate, (dt) => {
      onTickRef.current(dt);
    });
    loopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
      loopRef.current = null;
    };
  }, [tickRate, enabled]);

  return {
    setSpeed: (multiplier: number) => loopRef.current?.setSpeed(multiplier),
    pause: () => loopRef.current?.stop(),
    resume: () => loopRef.current?.start(),
  };
};
```

### Hook usage in a component

```typescript
const GameContainer = () => {
  const tickResources = useResourceStore((s) => s.tick);
  const tickCombat = useCombatStore((s) => s.tick);

  const { setSpeed, pause, resume } = useGameLoop(10, (dt) => {
    tickResources(dt);
    tickCombat(dt);
  });

  return (
    <div>
      <button onClick={() => setSpeed(1)}>1x</button>
      <button onClick={() => setSpeed(2)}>2x</button>
      <button onClick={() => setSpeed(5)}>5x</button>
      <button onClick={pause}>Pause</button>
      <button onClick={resume}>Resume</button>
    </div>
  );
};
```

---

## Tick-Based vs Real-Time Simulation

| Aspect | Tick-Based (Fixed Timestep) | Real-Time (Variable dt) |
|--------|---------------------------|------------------------|
| Determinism | Deterministic — same input = same output | Non-deterministic — varies by frame rate |
| Offline calc | Easy to fast-forward N ticks | Requires analytical formulas |
| Save/load | Exact state reproduction | Approximate |
| Best for | Idle games, strategy, simulation | Action games, physics |
| Tick rate | 10–20 tps | 60 fps (tied to rAF) |

---

## Multiple Loop Types

A full game typically runs three independent loops.

```typescript
// 1. Simulation loop — fixed timestep, game logic
const gameLoop = new GameLoop(10, (dt) => {
  engine.tick(dt);
});

// 2. Render loop — visual updates at screen refresh rate
const renderLoop = () => {
  renderer.draw();
  requestAnimationFrame(renderLoop);
};

// 3. Auto-save loop — periodic persistence
const autoSaveInterval = setInterval(() => {
  const save = engine.save();
  localStorage.setItem('game-save', JSON.stringify(save));
}, 30_000);

// Cleanup
const cleanup = () => {
  gameLoop.stop();
  clearInterval(autoSaveInterval);
};
```

---

## Pause/Resume Handling

```typescript
// Pause on tab hidden, resume on visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    gameLoop.stop();
    // Record timestamp for offline progress
    localStorage.setItem('lastActive', String(Date.now()));
  } else {
    // Calculate offline progress before resuming
    const lastActive = Number(localStorage.getItem('lastActive') || 0);
    if (lastActive > 0) {
      calculateOfflineProgress(lastActive, engine);
    }
    gameLoop.start();
  }
});
```

---

## Speed Control for Idle Games

Common speed tiers and their use cases.

```typescript
const SPEED_TIERS = [
  { label: '1x', multiplier: 1 },
  { label: '2x', multiplier: 2 },
  { label: '5x', multiplier: 5 },
  { label: 'Max', multiplier: 20 },
] as const;

// Max speed: increase tick rate instead of multiplier for accuracy
const setMaxSpeed = (loop: GameLoop) => {
  // At 20x with 10 tps base = 200 effective tps
  // Still well within browser performance budget
  loop.setSpeed(20);
};
```

---

## Time Scaling for Offline Progress

Use the game loop to fast-forward time when returning from offline.

```typescript
const processOfflineTime = (
  elapsedSeconds: number,
  engine: GameEngine,
) => {
  const MAX_OFFLINE_HOURS = 24;
  const capped = Math.min(elapsedSeconds, MAX_OFFLINE_HOURS * 3600);

  // Use larger tick steps for offline to reduce iterations
  const OFFLINE_TICK_RATE = 1; // 1 tick per second
  const totalTicks = Math.min(capped / (1 / OFFLINE_TICK_RATE), 1000);
  const tickDt = capped / totalTicks;

  for (let i = 0; i < totalTicks; i++) {
    engine.tick(tickDt);
  }

  return { processedSeconds: capped, ticks: totalTicks };
};
```
