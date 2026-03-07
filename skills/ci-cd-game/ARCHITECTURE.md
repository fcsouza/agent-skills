# CI/CD Pipeline — Architecture

## Pipeline Overview

```mermaid
flowchart LR
    PUSH[Git Push] --> LINT[Lint<br/>Biome]
    LINT --> TEST[Test<br/>Bun Test]
    TEST --> BUILD[Build<br/>TypeScript + Bundle]
    BUILD --> MIGRATE[DB Migration<br/>Drizzle Kit]
    MIGRATE --> HEALTH[Health Checks<br/>Postgres + Redis]
    HEALTH --> DEPLOY_STG[Deploy Staging]
    DEPLOY_STG --> SMOKE[Smoke Tests<br/>Staging]
    SMOKE --> APPROVE{Manual Approval}
    APPROVE -->|Approved| DEPLOY_PROD[Deploy Production]
    APPROVE -->|Rejected| STOP([Pipeline Stopped])

    style PUSH fill:#4CAF50,color:#fff
    style DEPLOY_PROD fill:#2196F3,color:#fff
    style STOP fill:#9E9E9E,color:#fff
    style APPROVE fill:#FF9800,color:#fff
```

## Detailed Stage Diagram

```mermaid
flowchart TD
    subgraph CI [Continuous Integration]
        PUSH[Push / PR] --> INSTALL[Install Dependencies<br/>bun install --frozen-lockfile]
        INSTALL --> LINT[Lint + Format<br/>bunx biome check .]
        LINT --> TYPECHECK[Type Check<br/>bunx tsc --noEmit]
        TYPECHECK --> TEST[Unit + Integration Tests<br/>bun test]
        TEST --> BUILD[Build<br/>bun run build]
    end

    subgraph CD_STG [Deploy to Staging]
        BUILD --> MIGRATE_STG[Run Migrations<br/>bunx drizzle-kit migrate]
        MIGRATE_STG --> REDIS_CHECK_STG[Redis Health Check]
        REDIS_CHECK_STG --> DEPLOY_S[Deploy Staging<br/>Docker Build + Push]
        DEPLOY_S --> SMOKE_S[Smoke Tests<br/>Health endpoint + WS connect]
    end

    subgraph CD_PROD [Deploy to Production]
        SMOKE_S --> GATE{Manual Gate}
        GATE -->|Approve| MIGRATE_PROD[Run Migrations<br/>bunx drizzle-kit migrate]
        MIGRATE_PROD --> REDIS_CHECK_PROD[Redis Health Check]
        REDIS_CHECK_PROD --> DEPLOY_P[Deploy Production<br/>Rolling Update]
        DEPLOY_P --> SMOKE_P[Smoke Tests<br/>Production]
        SMOKE_P --> MONITOR[Post-Deploy Monitoring<br/>5min error rate check]
    end

    style CI fill:#E8F5E9
    style CD_STG fill:#E3F2FD
    style CD_PROD fill:#FFF3E0
```

## GitHub Actions Workflow Structure

```
.github/workflows/
├── ci.yml              # Runs on every push and PR
├── deploy-staging.yml  # Runs on merge to main
└── deploy-prod.yml     # Manual trigger after staging approval
```

## Stage Details

### 1. Lint (Biome)

- Runs `bunx biome check .` to catch formatting and lint errors
- Fails fast: if lint fails, no further stages run
- Uses Biome config from `biome.json` / `biome.jsonc`

### 2. Test (Bun)

- Runs `bun test` for unit and integration tests
- Tests run against a local Postgres (via service container) and Redis
- Target: all tests pass, > 80% coverage on critical paths

### 3. Build

- TypeScript compilation and bundling
- Validates all imports resolve correctly
- Produces deployable artifacts

### 4. Database Migration

- Runs `bunx drizzle-kit migrate` against the target environment
- Migrations are idempotent and backward-compatible
- Staging runs first; production only after staging succeeds

### 5. Redis Health Check

- Verifies Redis is reachable and responsive
- Checks that required Redis data structures exist
- Timeout: 30 seconds

### 6. Deploy

- **Staging**: automatic on merge to `main`
- **Production**: manual approval required after staging smoke tests pass
- Rolling update strategy: zero downtime
- Automatic rollback if health checks fail within 5 minutes

### 7. Smoke Tests

- Hit `/health` endpoint, verify 200
- Open WebSocket connection, verify handshake
- Run one matchmaking round-trip (staging only)

## Environment Variables

| Variable | Staging | Production |
|----------|---------|------------|
| `DATABASE_URL` | Staging Neon branch | Production Neon |
| `REDIS_HOST` | Staging Redis | Production Redis |
| `NODE_ENV` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` |

## Rollback Strategy

1. Automatic rollback if error rate > 5% within 5 minutes post-deploy
2. Manual rollback via re-deploying previous Docker image tag
3. Database migrations must be backward-compatible (no destructive changes)
