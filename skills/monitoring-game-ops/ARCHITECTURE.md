# Monitoring & Game Ops — Architecture

## Observability Stack

```mermaid
flowchart TD
    GS[Game Server<br/>Elysia + WebSocket] --> SL[Structured Logs<br/>JSON via stdout]
    GS --> MET[Metrics<br/>Counters, Gauges, Histograms]
    GS --> TR[Traces<br/>Request + Tick Spans]

    SL --> LA[Log Aggregation<br/>e.g., Loki / ELK / Axiom]
    MET --> DASH[Dashboard<br/>e.g., Grafana / Datadog]
    TR --> DASH

    LA --> DASH
    LA --> ALERTS[Alert Engine]
    MET --> ALERTS

    ALERTS --> SLACK[Slack]
    ALERTS --> PD[PagerDuty]
    ALERTS --> EMAIL[Email]
    ALERTS --> WEBHOOK[Webhook / Discord]

    style GS fill:#4CAF50,color:#fff
    style ALERTS fill:#f44336,color:#fff
    style DASH fill:#2196F3,color:#fff
```

## Data Flow

1. **Game Server** emits structured JSON logs to stdout and metrics to a collector.
2. **Log Aggregation** indexes logs for search, filtering, and alerting.
3. **Metrics** are scraped or pushed to a time-series database.
4. **Dashboard** provides real-time and historical visualization.
5. **Alert Engine** evaluates rules against metrics and logs, sends notifications.

## Key Metrics

| Category | Metric | Type | Target | Alert Threshold |
|----------|--------|------|--------|----------------|
| Server | Tick time (p95) | Histogram | < 16ms | > 50ms |
| Server | API response (p95) | Histogram | < 200ms | > 500ms |
| Server | Concurrent players | Gauge | N/A | > 80% capacity |
| Server | Memory usage (%) | Gauge | < 70% | > 85% |
| Server | Error rate (%) | Counter | < 1% | > 5% |
| Server | WebSocket disconnect rate | Counter | < 5/min | > 50/min |
| Queue | Waiting jobs | Gauge | < 100 | > 500 |
| Queue | Processing time (p95) | Histogram | < 5s | > 30s |
| Game | Match duration (p95) | Histogram | < 30min | > 60min |
| Game | Matchmaking wait (p95) | Histogram | < 30s | > 120s |
| Economy | Balance ratio | Gauge | ~0 | > 0.3 |
| Economy | Transaction volume | Counter | Baseline | > 3x baseline |

## Log Format

All logs use structured JSON via the `GameLogger` class:

```json
{
  "level": "info",
  "message": "request_end",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "context": {
    "service": "game-server",
    "component": "http",
    "requestId": "abc-123",
    "playerId": "player-456"
  },
  "data": {
    "method": "GET",
    "url": "/api/players/player-456",
    "status": 200,
    "durationMs": 12.5
  }
}
```

## Alert Severity Levels

| Severity | Response Time | Action |
|----------|--------------|--------|
| **Info** | Next business day | Review in standup |
| **Warning** | Within 4 hours | Investigate, may need action |
| **Critical** | Within 30 minutes | Immediate investigation required |
| **Fatal** | Immediate | All hands, service is down |

## Files in This Skill

| File | Purpose |
|------|---------|
| `boilerplate/logger.ts` | GameLogger class, request middleware, session logger |
| `templates/alert-config.ts` | AlertRule interface and preset alert definitions |
