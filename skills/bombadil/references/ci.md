# Bombadil in CI

Not verified here. This page follows the `antithesishq/bombadil-action` README and its `action.yml`, read on 2026-11-22. The repo had tags `v1`, `v2` and `v3`. No workflow below was run. Check the README again before you rely on an input name.

## What the action does

- Installs `@antithesishq/bombadil` from npm. Its `version` input defaulted to `0.7.3` when read, older than 0.8.0. Pin `version` to the version you tested locally.
- For the browser driver, downloads Chrome with `@puppeteer/browsers` and caches it (`chrome-version`, default `stable`; `cache`, default `true`). Set the `CHROME` environment variable to use a Chrome already on the runner.
- Runs one bounded test. The README calls `time-limit` and `specification` required, and `origin` (browser) or `command` (terminal). `action.yml` marks every input optional. Pass all four that apply; without `time-limit` a test has no end.
- Sets the output `exit-code`: `0` clean, `2` violation, anything else an error (README wording). The local terminal driver exited `1` on a violation in 0.8.0, so do not assume `2` for terminal jobs.
- Does not upload anything. Add an upload step with `if: always()`.

Other inputs mirror the CLI flags: `exit-on-violation`, `output-path`, `output-path-overwrite`, `width`, `height`, `device-scale-factor`, `instrument-javascript`, `chrome-grant-permissions`, `headers` (multi-line `Key: Value`), `cookies` (one per line), `no-sandbox` (default `true`), and for the terminal `columns`, `rows`, `scrollback-lines-max`, `quiescence-timeout-ms`.

The manual's install page showed `@v2`; the README showed `@v3`, the newest tag. Use `@v3`, and pin it to a commit SHA if your repo pins actions.

## Browser workflow

Start the app with seed data the job owns, wait until it answers, then run the action against localhost.

```yaml
name: bombadil
on:
  pull_request:
  push:
    branches: [main]

jobs:
  ui-fuzz:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7       # pin to a SHA as your repo does
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run start &
      - run: curl --retry 30 --retry-all-errors --retry-delay 2 --silent --fail http://localhost:3000 >/dev/null
      - uses: antithesishq/bombadil-action@v3
        with:
          version: 0.8.0
          driver: browser
          origin: http://localhost:3000
          specification: ./bombadil/spec.ts
          time-limit: 5m
          exit-on-violation: true
          output-path: bombadil-output
      - if: always()
        uses: actions/upload-artifact@v7
        with:
          name: bombadil-output
          path: bombadil-output
```

The `upload-artifact@v7` line follows the README example. The `checkout@v7` and `setup-bun@v2` majors follow the pinned versions in this skills repo's own CI. Check each against its releases page before use.

## Terminal workflow

```yaml
      - uses: antithesishq/bombadil-action@v3
        with:
          version: 0.8.0
          driver: terminal
          command: ./my-program --flag
          specification: ./bombadil/terminal-specification.ts
          time-limit: 5m
          exit-on-violation: true
          output-path: bombadil-output
```

## Choosing what runs where

- Pull requests: a short run (a few minutes) with `exit-on-violation: true`, so a violation fails the check fast.
- Main branch or a nightly job: longer runs. The manual suggests longer tests on main or against a deployed staging environment.
- Never point a CI job at production.

When a CI run fails, download the artifact and work from the trace locally: `bunx bombadil trace bombadil-output --json`, then reproduce and shrink with the same options as the job.
