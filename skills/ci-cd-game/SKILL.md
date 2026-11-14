---
name: ci-cd-game
description: >-
  GitHub Actions pipeline rules for a Bun game backend on Neon and Fly.io: migrations before deploy, one Neon database branch per pull request, a smoke test after deploy, and a pinned Bun version. Use when a game project needs CI, a deploy workflow, preview databases for pull requests, or a safe order for schema migrations and server deploys.
---

# CI/CD for Games

General GitHub Actions syntax comes from the vendor: use the `github-actions-templates` skill if it is installed, otherwise https://docs.github.com/en/actions. This skill covers the parts a game backend adds.

## Files

- `boilerplate/ci.yml`: copy when setting up CI. Lint, type check and tests on every push to `main` and every pull request; each pull request gets its own Neon branch, deleted when the pull request closes.
- `boilerplate/deploy.yml`: copy when setting up deploys. Migrate, then deploy to Fly.io, then smoke test.

Both go in `.github/workflows/`. They expect the project's `package.json` to define `lint:biome` (`ultracite check`), `format` (`ultracite fix`), `typecheck` and `smoke`, and `drizzle.config.ts` to read `DATABASE_URL`. Secrets: `NEON_API_KEY`, `DATABASE_URL`, `DATABASE_URL_TEST`, `REDIS_URL_TEST`, `FLY_API_TOKEN`. Variables: `NEON_PROJECT_ID`, `NEON_CI_PARENT_BRANCH`, `GAME_URL`.

## Rules

1. **Migrate before deploy.** A separate `migrate` job runs `bunx drizzle-kit migrate`; `deploy` declares `needs: migrate`. If migrations fail, GitHub skips the deploy and the old server keeps running.
2. **Migrations must work with the previous server image.** A Fly rollback redeploys an old image and leaves the database as it is. Add columns and tables in one release; drop or rename them in a later release, once no running image reads them. Roll back with `fly releases --app <app> --image` to find the previous image, then `fly deploy --image <that image>`.
3. **One deploy at a time.** `deploy.yml` sets a `concurrency` group so two quick merges never migrate production together. A newer pending run replaces an older pending one; a running one finishes.
4. **One Neon branch per pull request.** `ci.yml` creates `preview/pr-<number>`, migrates it and runs the tests against it. The action's `parent_branch` input is set from the `NEON_CI_PARENT_BRANCH` variable; without it the branch copies the project's default branch, usually production. The `closed` event deletes the branch. On later pushes the action returns the existing branch and Drizzle applies only the new migrations.
5. **Never branch CI databases from production.** Pull-request code runs migrations and tests on the branch, so a production parent hands it a full copy of player data. Keep a seed branch with synthetic or anonymised data and name it in `NEON_CI_PARENT_BRANCH`, or use a separate Neon project for CI. `ci.yml` fails before creating the branch when that variable is empty, so a missing variable stops CI instead of copying production. Neon's schema-only branches copy the schema without data, for filling with randomized or anonymized rows; the feature is in beta.
6. **Smoke test the game, not only the server.** After deploy, check `/health`, then run `bun run smoke`: open a WebSocket and complete the handshake, then run one matchmaking round trip. A server can answer HTTP and still fail every game session.
7. **Pin Bun.** Without `bun-version`, setup-bun reads `packageManager` or `engines.bun` from `package.json` and falls back to `latest`, which changes with each Bun release. The lockfile format has changed between Bun versions (1.2 moved to the text `bun.lock`), so pin the version the team runs locally and bump it on purpose. Hash `bun.lock` in the cache key.
8. **Gate production on people when needed.** Add required reviewers to the `production` environment. Only the `migrate` job references it, so one approval releases migrate, deploy and smoke.
9. **Pin third-party actions by commit SHA.** The Neon actions receive the Neon API key, and a tag can be moved. The boilerplate pins every action not published by GitHub to a full commit SHA with the release tag as a trailing comment (flyctl has no current release, so its comment names the branch and date); let Dependabot or Renovate bump the pins. GitHub's workflow dependency lockfile (`.github/workflows/actions.lock`, made with `gh actions-lock`) is the stronger option where a repository can adopt it. Make `NEON_API_KEY` a project-scoped key, which reaches a single project; creating one needs a Neon organization admin.
10. **Keep one main branch and let tests gate every deploy.** Rare shipped Sea of Thieves this way: trunk-based development and heavy investment in automated tests. `deploy.yml` does not wait for `ci.yml`, so protect `main` and require the `test` check before merging.

## Pitfalls

- **Pull requests from forks.** GitHub passes no secrets to them, so the Neon step fails. Run those pull requests from a branch in the repository, or skip the database steps for forks.
- **Dependabot pull requests.** Workflows started by Dependabot see only Dependabot secrets, not Actions secrets. Store `NEON_API_KEY`, `DATABASE_URL_TEST` and `REDIS_URL_TEST` as Dependabot secrets too, or every pin bump fails at the Neon step.
- **Destructive migration in the same release as the code change.** The rollback image then reads a column that no longer exists. Split it across two releases (rule 2).
- **Health check only.** `/health` passes while WebSocket upgrades or matchmaking fail. Keep the smoke script.
- **Cache key on a missing file.** `hashFiles` returns an empty string when no file matches, so the key stops changing when dependencies change. Hash `bun.lock`, the file Bun writes.

## Related skills

- `postgres-game-schema` for the schema and migration conventions.
- `game-backend-architecture` for what gets deployed.
- `monitoring-game-ops` for alerts after a deploy.
- For Neon branching beyond this workflow, use the `neon-postgres` skill if it is installed, otherwise https://neon.com/docs/guides/branching-github-actions.

Verified citations are in `references/sources.md`; read it when checking where a claim comes from.
