# Performance Optimization Reference

## React Rendering

The core principle: **game state lives outside React**. The game loop updates Zustand stores, and React re-renders only when selectors detect changes.

### Separate Game State from UI State

```typescript
// WRONG: Game loop inside useEffect
const GameBad = () => {
  const [gold, setGold] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setGold((g) => g + 1); // Triggers re-render every tick
    }, 100);
    return () => clearInterval(interval);
  }, []);
  return <div>{gold}</div>;
};

// RIGHT: Game loop outside React, selective re-rendering
const GameGood = () => {
  // Only re-renders when gold value changes
  const gold = useResourceStore((s) => s.resources.gold?.amount ?? 0);
  return <div>{Math.floor(gold)}</div>;
};
```

### React.memo for Expensive Components

```typescript
import { memo } from 'react';

const InventoryItem = memo(({ item }: { item: Item }) => {
  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <img src={item.icon} alt={item.name} className="w-8 h-8" />
      <span>{item.name}</span>
      <span className="text-muted-foreground">x{item.quantity}</span>
    </div>
  );
});

InventoryItem.displayName = 'InventoryItem';
```

### Throttled Display Updates

For values that change every tick (gold counter), throttle the display update.

```typescript
import { useEffect, useRef, useState } from 'react';

const useThrottledValue = <T,>(selector: () => T, fps = 10): T => {
  const [value, setValue] = useState(selector);
  const lastUpdate = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      if (now - lastUpdate.current >= 1000 / fps) {
        setValue(selector());
        lastUpdate.current = now;
      }
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [selector, fps]);

  return value;
};

// Usage: Update gold display at 10fps instead of every tick
const GoldCounter = () => {
  const gold = useThrottledValue(
    () => useResourceStore.getState().resources.gold?.amount ?? 0,
    10,
  );
  return <span>{Math.floor(gold)}</span>;
};
```

---

## Canvas vs DOM Decision Tree

```
Is the game primarily text-based?
├── Yes → DOM (idle games, text RPGs, management sims)
│   └── Use Tailwind + React components
└── No → Does it have real-time visual elements?
    ├── Yes → Canvas (platformers, shooters, tower defense)
    │   └── React overlay for UI (health bars, menus, chat)
    └── Hybrid → Canvas for game world, DOM for UI panels
```

### Canvas Rendering with React Overlay

```typescript
import { useEffect, useRef } from 'react';

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const render = () => {
      renderSystem(world, ctx);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="relative">
      {/* Canvas for game rendering */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border rounded"
      />
      {/* React overlay for UI */}
      <div className="absolute top-4 left-4">
        <ResourcePanel />
      </div>
      <div className="absolute bottom-4 left-4">
        <SkillBar />
      </div>
    </div>
  );
};
```

---

## Web Workers

### Offline Progress Worker

Offload heavy offline calculations to prevent UI blocking.

```typescript
// workers/offline-progress.ts
self.onmessage = (event: MessageEvent) => {
  const { saveData, elapsedSeconds, tickRate } = event.data;

  const maxTicks = Math.min(elapsedSeconds * tickRate, 1000);
  const tickDt = elapsedSeconds / maxTicks;

  // Simulate ticks on save data
  const state = { ...saveData };

  for (let i = 0; i < maxTicks; i++) {
    // Simple resource accumulation
    for (const resource of Object.values(state.resources) as Array<{
      amount: number;
      perSecond: number;
      total: number;
    }>) {
      const gained = resource.perSecond * tickDt;
      resource.amount += gained;
      resource.total += gained;
    }
  }

  self.postMessage({ result: state, ticks: maxTicks });
};
```

```typescript
// Using the worker
const calculateOfflineAsync = (
  saveData: GameSave,
  elapsedSeconds: number,
): Promise<GameSave> => {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL('./workers/offline-progress.ts', import.meta.url),
    );

    worker.onmessage = (event) => {
      resolve(event.data.result);
      worker.terminate();
    };

    worker.postMessage({
      saveData,
      elapsedSeconds,
      tickRate: 10,
    });
  });
};
```

---

## Virtualized Lists

Use `@tanstack/react-virtual` for large inventories, chat logs, or leaderboards.

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface Item {
  id: string;
  name: string;
  icon: string;
  quantity: number;
}

const VirtualizedInventory = ({ items }: { items: Item[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        className="relative w-full"
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={item.id}
              className="absolute top-0 left-0 w-full flex items-center gap-2 p-2 border-b"
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <img src={item.icon} alt={item.name} className="w-8 h-8" />
              <span className="flex-1">{item.name}</span>
              <span className="text-muted-foreground">x{item.quantity}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

## Asset Loading

### Lazy Load Game Systems

```typescript
// Load game areas on demand
const loadDungeon = async () => {
  const { DungeonSystem } = await import('./systems/DungeonSystem');
  return new DungeonSystem();
};

const loadPvP = async () => {
  const { PvPSystem } = await import('./systems/PvPSystem');
  return new PvPSystem();
};

// Preload on hover/intent
const AreaButton = ({ area, onLoad }: { area: string; onLoad: () => void }) => {
  const preload = () => {
    if (area === 'dungeon') import('./systems/DungeonSystem');
    if (area === 'pvp') import('./systems/PvPSystem');
  };

  return (
    <button onMouseEnter={preload} onClick={onLoad}>
      Enter {area}
    </button>
  );
};
```

### Image Preloader

```typescript
class AssetLoader {
  private cache: Map<string, HTMLImageElement> = new Map();
  private loading: Map<string, Promise<HTMLImageElement>> = new Map();

  async load(src: string): Promise<HTMLImageElement> {
    if (this.cache.has(src)) return this.cache.get(src)!;
    if (this.loading.has(src)) return this.loading.get(src)!;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        this.loading.delete(src);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });

    this.loading.set(src, promise);
    return promise;
  }

  async preloadBatch(sources: string[]): Promise<void> {
    await Promise.all(sources.map((src) => this.load(src)));
  }

  get(src: string): HTMLImageElement | undefined {
    return this.cache.get(src);
  }
}

const imageCache = new AssetLoader();
```

---

## Memory Management

### Cleanup on Unmount

```typescript
import { useEffect } from 'react';

const useCleanup = (gameLoop: GameLoop, autoSaveId: number) => {
  useEffect(() => {
    return () => {
      gameLoop.stop();
      clearInterval(autoSaveId);
      // Final save on cleanup
      saveGame();
    };
  }, [gameLoop, autoSaveId]);
};
```

### Object Pooling for Frequent Spawns

```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 50) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }

  release(obj: T) {
    this.reset(obj);
    this.pool.push(obj);
  }

  get size() {
    return this.pool.length;
  }
}

// Usage: pool for projectile data
const projectilePool = new ObjectPool(
  () => ({ x: 0, y: 0, dx: 0, dy: 0, damage: 0, active: false }),
  (p) => {
    p.x = 0;
    p.y = 0;
    p.dx = 0;
    p.dy = 0;
    p.damage = 0;
    p.active = false;
  },
  100,
);
```

---

## Bundle Optimization

### Code Split Per Game Area

```typescript
// next.config.ts — dynamic imports in page routes
// app/game/page.tsx loads core systems
// app/game/dungeon/page.tsx dynamically loads dungeon

import dynamic from 'next/dynamic';

const DungeonView = dynamic(() => import('@/components/game/DungeonView'), {
  loading: () => <div className="animate-pulse">Loading dungeon...</div>,
});

const AdminTools = dynamic(() => import('@/components/game/AdminTools'), {
  ssr: false,
});
```

### Performance Monitoring

```typescript
const measureTickPerformance = (engine: GameEngine) => {
  const start = performance.now();
  engine.tick(1 / 10);
  const duration = performance.now() - start;

  if (duration > 16) {
    console.warn(`Tick took ${duration.toFixed(1)}ms (budget: 16ms)`);
  }
};

// Monitor heap usage in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (memory) {
      const mb = memory.usedJSHeapSize / 1024 / 1024;
      if (mb > 200) {
        console.warn(`Heap: ${mb.toFixed(0)}MB — check for leaks`);
      }
    }
  }, 10_000);
}
```
