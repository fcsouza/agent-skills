---
name: monitoring-game-ops
description: >-
  Use when implementing game monitoring, structured logging, player telemetry, alerting rules, or performance budgets. Triggers: monitoring, logging, telemetry, alerts, observability, metrics.
---

# Monitoring & Game Ops

## Purpose

Structured logging, player telemetry, alerting, and performance budgets for game servers.

## When to Use

Trigger: monitoring, logging, telemetry, alerting, performance, metrics, observability, error tracking, player analytics, server health, uptime

## Prerequisites

- `game-backend-architecture` — what we're monitoring
- `redis-game-patterns` — metrics storage

## Core Principles

1. **Structured logging** — JSON logs with consistent fields; never unstructured console.log in production
2. **Player telemetry** — track actions, session length, retention, spending — anonymized
3. **Alert on anomalies** — sudden drops in DAU, spike in errors, economy inflation
4. **Performance budgets** — server tick must complete in < 16ms (60fps); API responses < 200ms p95
5. **Dashboard first** — if you can't see it, you can't fix it

## Key Metrics

| Category | Metric | Target | Alert Threshold |
|----------|--------|--------|----------------|
| Server | Tick time (p95) | < 16ms | > 50ms |
| Server | API response (p95) | < 200ms | > 500ms |
| Server | WebSocket connections | N/A | > 80% capacity |
| Server | Error rate | < 0.1% | > 1% |
| Player | DAU | Trending up | -20% day-over-day |
| Player | Session length (median) | 10-30 min | < 5 min |
| Player | Day 1 retention | > 40% | < 25% |
| Player | Day 7 retention | > 15% | < 8% |
| Economy | Currency in circulation | Stable | +50% week-over-week |
| Economy | Revenue per DAU | Stable | -30% week-over-week |

## Log Schema

```typescript
interface GameLogEntry {
  timestamp: string;     // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;       // 'game-server' | 'api' | 'worker'
  event: string;         // 'player.login' | 'combat.resolved' | 'purchase.completed'
  playerId?: string;
  sessionId?: string;
  data: Record<string, unknown>;
  duration?: number;     // ms, for timed operations
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}
```

## Cross-References

- `game-backend-architecture` — server topology to monitor
- `redis-game-patterns` — real-time metrics storage
- `bullmq-game-queues` — queue health monitoring
- `stripe-game-payments` — revenue tracking
- `ci-cd-game` — post-deployment monitoring

## Sources

- "Game Server Monitoring at Scale" — GDC 2020
- "Player Telemetry Best Practices" — GDC 2019
- OpenTelemetry documentation
