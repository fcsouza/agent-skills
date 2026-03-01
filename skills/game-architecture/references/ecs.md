# Entity-Component-System Reference

## Minimal ECS World

Complete implementation for browser games.

```typescript
type ComponentType = string;
type Entity = number;
type ComponentData = Record<string, unknown>;

class World {
  private nextId = 0;
  private entities: Set<Entity> = new Set();
  private components: Map<ComponentType, Map<Entity, ComponentData>> = new Map();
  private queryCache: Map<string, Entity[]> = new Map();
  private dirty = true;

  createEntity(): Entity {
    const id = this.nextId++;
    this.entities.add(id);
    this.dirty = true;
    return id;
  }

  removeEntity(entity: Entity) {
    this.entities.delete(entity);
    for (const store of this.components.values()) {
      store.delete(entity);
    }
    this.dirty = true;
  }

  addComponent<T extends ComponentData>(
    entity: Entity,
    type: ComponentType,
    data: T,
  ): T {
    if (!this.components.has(type)) {
      this.components.set(type, new Map());
    }
    this.components.get(type)!.set(entity, data);
    this.dirty = true;
    return data;
  }

  getComponent<T extends ComponentData>(
    entity: Entity,
    type: ComponentType,
  ): T | undefined {
    return this.components.get(type)?.get(entity) as T | undefined;
  }

  removeComponent(entity: Entity, type: ComponentType) {
    this.components.get(type)?.delete(entity);
    this.dirty = true;
  }

  hasComponent(entity: Entity, type: ComponentType): boolean {
    return this.components.get(type)?.has(entity) ?? false;
  }

  query(...types: ComponentType[]): Entity[] {
    const key = types.sort().join(',');

    if (!this.dirty && this.queryCache.has(key)) {
      return this.queryCache.get(key)!;
    }

    const result: Entity[] = [];
    for (const entity of this.entities) {
      if (types.every((t) => this.hasComponent(entity, t))) {
        result.push(entity);
      }
    }

    this.queryCache.set(key, result);
    if (types.length === [...this.queryCache.keys()].length) {
      this.dirty = false;
    }

    return result;
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  clear() {
    this.entities.clear();
    this.components.clear();
    this.queryCache.clear();
    this.nextId = 0;
    this.dirty = true;
  }
}
```

---

## Component Type Definitions

Use interfaces for type safety when getting components.

```typescript
interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

interface Health {
  current: number;
  max: number;
}

interface Sprite {
  src: string;
  width: number;
  height: number;
}

interface Damage {
  amount: number;
  type: 'physical' | 'magical' | 'fire' | 'ice';
}

interface Lifetime {
  remaining: number;
}

interface Collider {
  radius: number;
  layer: 'player' | 'enemy' | 'projectile';
}
```

---

## System Examples

Systems are plain functions that query entities and operate on their components.

### Movement System

```typescript
const movementSystem = (world: World, dt: number) => {
  const entities = world.query('Position', 'Velocity');

  for (const entity of entities) {
    const pos = world.getComponent<Position>(entity, 'Position')!;
    const vel = world.getComponent<Velocity>(entity, 'Velocity')!;

    pos.x += vel.dx * dt * 60;
    pos.y += vel.dy * dt * 60;
  }
};
```

### Lifetime System

```typescript
const lifetimeSystem = (world: World, dt: number) => {
  const entities = world.query('Lifetime');

  for (const entity of entities) {
    const lifetime = world.getComponent<Lifetime>(entity, 'Lifetime')!;
    lifetime.remaining -= dt;

    if (lifetime.remaining <= 0) {
      world.removeEntity(entity);
    }
  }
};
```

### Collision System

```typescript
const collisionSystem = (world: World) => {
  const entities = world.query('Position', 'Collider');

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];

      const posA = world.getComponent<Position>(a, 'Position')!;
      const posB = world.getComponent<Position>(b, 'Position')!;
      const colA = world.getComponent<Collider>(a, 'Collider')!;
      const colB = world.getComponent<Collider>(b, 'Collider')!;

      // Skip same-layer collisions
      if (colA.layer === colB.layer) continue;

      const dx = posA.x - posB.x;
      const dy = posA.y - posB.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < colA.radius + colB.radius) {
        handleCollision(world, a, b);
      }
    }
  }
};

const handleCollision = (world: World, a: Entity, b: Entity) => {
  // Check if projectile hitting enemy
  const damageA = world.getComponent<Damage>(a, 'Damage');
  const healthB = world.getComponent<Health>(b, 'Health');

  if (damageA && healthB) {
    healthB.current -= damageA.amount;
    world.removeEntity(a); // Remove projectile

    if (healthB.current <= 0) {
      world.removeEntity(b); // Remove enemy
    }
  }
};
```

### Render System (Canvas)

```typescript
const renderSystem = (world: World, ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const entities = world.query('Position', 'Sprite');

  for (const entity of entities) {
    const pos = world.getComponent<Position>(entity, 'Position')!;
    const sprite = world.getComponent<Sprite>(entity, 'Sprite')!;

    // Assume images are preloaded in a cache
    const img = imageCache.get(sprite.src);
    if (img) {
      ctx.drawImage(img, pos.x, pos.y, sprite.width, sprite.height);
    }
  }

  // Render health bars
  const healthEntities = world.query('Position', 'Health');
  for (const entity of healthEntities) {
    const pos = world.getComponent<Position>(entity, 'Position')!;
    const health = world.getComponent<Health>(entity, 'Health')!;

    const barWidth = 40;
    const barHeight = 4;
    const ratio = health.current / health.max;

    ctx.fillStyle = '#333';
    ctx.fillRect(pos.x, pos.y - 10, barWidth, barHeight);
    ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(pos.x, pos.y - 10, barWidth * ratio, barHeight);
  }
};
```

---

## Spawning Entities

```typescript
const spawnEnemy = (world: World, x: number, y: number) => {
  const entity = world.createEntity();
  world.addComponent(entity, 'Position', { x, y });
  world.addComponent(entity, 'Velocity', { dx: -1, dy: 0 });
  world.addComponent(entity, 'Health', { current: 50, max: 50 });
  world.addComponent(entity, 'Collider', { radius: 16, layer: 'enemy' as const });
  world.addComponent(entity, 'Sprite', {
    src: '/sprites/enemy.png',
    width: 32,
    height: 32,
  });
  return entity;
};

const spawnProjectile = (world: World, x: number, y: number, dx: number, dy: number) => {
  const entity = world.createEntity();
  world.addComponent(entity, 'Position', { x, y });
  world.addComponent(entity, 'Velocity', { dx, dy });
  world.addComponent(entity, 'Damage', { amount: 10, type: 'physical' as const });
  world.addComponent(entity, 'Collider', { radius: 4, layer: 'projectile' as const });
  world.addComponent(entity, 'Lifetime', { remaining: 3 });
  return entity;
};
```

---

## When to Use ECS

| Scenario | Use ECS? | Why |
|----------|----------|-----|
| 100+ enemies with shared behavior | Yes | Query-based updates scale well |
| Bullet hell / particle systems | Yes | Many short-lived entities with common components |
| Tower defense with many towers + enemies | Yes | Dynamic composition, shared systems |
| Simple idle game with 5 resources | No | Plain objects are simpler and more readable |
| Turn-based RPG with fixed party | No | Named objects with unique logic are clearer |
| MMO with diverse entity types | Yes | Components compose better than deep inheritance |

---

## Performance Notes

- **Map-based storage**: O(1) component add/get/remove per entity.
- **Query caching**: Queries are cached and invalidated on structural changes (add/remove entity/component). Avoid querying with constantly changing component sets.
- **Entity count sweet spot**: ECS overhead pays off at 50+ similar entities. Below that, plain objects with direct references are faster.
- **Avoid allocations in systems**: Reuse arrays, don't create objects per tick.
- **System ordering matters**: Run movement before collision, collision before cleanup.
