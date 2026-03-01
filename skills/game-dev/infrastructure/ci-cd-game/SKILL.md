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

## Cross-References

- `postgres-game-schema` — migration safety in deployments
- `monitoring-game-ops` — post-deployment monitoring
- `game-backend-architecture` — server deployment targets

## Sources

- GitHub Actions documentation
- "Continuous Delivery for Games" — GDC DevOps talks
