---
name: infrastructure-ci-cd-game
description: >-
  Use when setting up CI/CD pipelines, GitHub Actions workflows, deployment automation, migration safety, or staging environments for game projects. Triggers: CI/CD, GitHub Actions, deployment, pipeline, staging.
---

# CI/CD for Games

## Purpose

GitHub Actions pipelines, test strategies, migration safety, and staging environments for game projects.

## When to Use

Trigger: CI/CD, GitHub Actions, deployment, pipeline, testing, staging, migration, continuous integration, continuous deployment, build pipeline, release

## Prerequisites

- `postgres-game-schema` — migration safety
- `game-backend-architecture` — what we're deploying

## Core Principles

1. **Never deploy without tests** — automated tests gate every deployment
2. **Migrations are one-way** — never run destructive migrations in production without backup
3. **Staging mirrors production** — test with real data shapes, real Redis, real PostgreSQL
4. **Feature flags over branches** — deploy dark features, enable via config
5. **Rollback plan always** — every deployment has a revert strategy
6. **Monitor after deploy** — `monitoring-game-ops` alerts catch post-deploy issues

## Pipeline Stages

```
Push → Lint → Type Check → Unit Tests → Build → Integration Tests → Deploy Staging → Smoke Tests → Deploy Production
```

## Step-by-Step: CI Pipeline

Set up CI with Bun + GitHub Actions:

1. **Use `oven-sh/setup-bun@v2`** — not `actions/setup-node`. Bun is the runtime.
2. **Cache bun install**:
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.bun/install/cache
       key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
       restore-keys: |
         ${{ runner.os }}-bun-
   ```
3. **Steps in order**:
   - `bun install --frozen-lockfile` — reproducible installs
   - `bunx biome check .` — lint and format check
   - `bun run typecheck` — TypeScript strict mode
   - `bun test` — unit and integration tests
4. **Environment variables for tests**:
   - `DATABASE_URL` — Neon test branch connection string
   - `REDIS_URL` — test Redis instance

See `boilerplate/ci.yml` for the complete workflow.

## Step-by-Step: Deploy Pipeline

1. **Drizzle migration job** (runs before deploy):
   - Separate job that runs `bunx drizzle-kit migrate` with production `DATABASE_URL`
   - Deploy job declares `needs: migrate` so it only runs after migrations succeed
2. **Deploy to Fly.io**:
   - Use `superfly/flyctl-actions/setup-flyctl@master` to install flyctl
   - Run `flyctl deploy --remote-only` — builds on Fly's infrastructure, no local Docker required
   - Auth via `FLY_API_TOKEN` secret
3. **Post-deploy health check**:
   ```bash
   APP_NAME=$(flyctl info --json | jq -r '.Name')
   curl --retry 5 --retry-delay 10 -f "https://${APP_NAME}.fly.dev/health"
   ```
4. **Rollback strategy**:
   - Fly.io machines support instant rollback: `flyctl releases rollback`
   - Every deploy creates a new release — previous release is always available
   - Combine with feature flags to disable broken features without a full rollback

See `boilerplate/deploy.yml` for the complete workflow.

## Neon Database Branching

For preview environments (per-PR Neon branching):

- Neon supports database branches — each PR gets its own isolated database branch
- Use `neondatabase/create-branch-action@v5` in GitHub Actions:
  ```yaml
  - uses: neondatabase/create-branch-action@v5
    id: create_branch
    with:
      project_id: ${{ secrets.NEON_PROJECT_ID }}
      branch_name: preview/pr-${{ github.event.number }}
      api_key: ${{ secrets.NEON_API_KEY }}
  ```
- Branch connection string available as `${{ steps.create_branch.outputs.db_url }}`
- Delete branch on PR close with `neondatabase/delete-branch-action@v3`
- This gives each PR a real isolated database — no shared test state pollution

## boilerplate/ci.yml and boilerplate/deploy.yml

See `boilerplate/ci.yml` for a complete, production-ready CI workflow and `boilerplate/deploy.yml` for the deployment workflow with migration safety. Both files are ready to copy into `.github/workflows/`.

## Cross-References

- `postgres-game-schema` — migration safety in deployments
- `monitoring-game-ops` — post-deployment monitoring
- `game-backend-architecture` — server deployment targets

## Sources

- GitHub Actions documentation
- "Continuous Delivery for Games" — GDC DevOps talks
