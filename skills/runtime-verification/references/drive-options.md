# Driving the app

Pick the first option that works for the surface. Test it by hand once before you write it into the skill.

## Order

1. **The repo's own harness.** Playwright or Cypress specs, an expect script, a PTY helper, a seeded test user. It already knows the selectors and the setup. Call it from the verify skill; write a helper only for what it lacks.
2. **A browser for web pages and Electron.** Playwright, or Chrome DevTools Protocol (CDP) through Playwright's `connectOverCDP`.
3. **A PTY or tmux for TUIs.** A plain subprocess for CLIs that do not prompt.
4. **Plain HTTP for services** whose users are other programs.

A browser tool in the agent's own session (a browser pane, a Chrome extension) helps you explore the page while you write the skill. The verify skill itself needs a scripted driver, so the next agent can rerun it without that tool.

## Web pages: Playwright

Check whether the repo already depends on Playwright (`package.json`) and whether a browser build exists. On macOS the browsers live in `~/Library/Caches/ms-playwright`; on Linux in `~/.cache/ms-playwright`. Installing a browser downloads one; ask first.

```ts
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.getByLabel('Title', { exact: true }).fill('Release checklist');
await page.getByRole('button', { name: 'Save note', exact: true }).click();
await page.screenshot({ path: `${evidenceDir}/create-note-saved.png`, fullPage: true });
const aria = await page.locator('body').ariaSnapshot();
await browser.close();
```

This ran under Bun with Playwright 1.65.1 during the proof run. Use `getByRole`, `getByLabel` and `getByTestId`. Pass `exact: true`: without it the match is a case-insensitive substring. On the proof app, `getByLabel('notes')` matched two elements and `getByLabel('notes', { exact: true })` matched none. Wait for the state you expect (`waitForLoadState`, a locator), not a fixed sleep.

## Electron and running Chrome: CDP

Start the app with a debug port, then attach.

```bash
<electron-app> --remote-debugging-port=9222
```

```ts
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0].pages()[0];
```

Use a throwaway port per run, and a throwaway browser profile (`--user-data-dir=<run dir>`) for Chrome, so the run never touches the user's own profile. The proof run did not exercise this path.

## CLIs and TUIs

A CLI that never prompts needs only a subprocess. Capture the command, stdout, stderr and exit code.

```ts
const proc = Bun.spawnSync(['bun', 'src/cli.ts', 'search', 'quarterly', '--json'], { env: { ...process.env, NOTES_DATA_DIR: dataDir } });
```

A TUI or a prompting CLI needs a terminal. With tmux:

```bash
tmux new-session -d -s verify-<run> -x 120 -y 40 '<command>'
tmux send-keys -t verify-<run> 'quarterly' Enter
tmux capture-pane -p -t verify-<run> > "$EVIDENCE/search-after.txt"
tmux kill-session -t verify-<run>
```

Name the session after the run, and kill only that session in Cleanup. Without tmux, a PTY library or `expect` does the same job. The proof run had no tmux, so this recipe is not verified.

## HTTP services

`curl` or `fetch` is the user path when the users are programs. Record method, URL, body, status and response. Read every write back with a second request or through the store.

## Ports and processes

- Choose a free port per run. Binding port 0 and reading the port the OS chose is one way.
- Record the process ID that holds the port. A script runner such as `bun run dev` or `npm run dev` may start a child; the proof run saw a different PID behind the port than the one it spawned. Spawn the server command directly, or have Doctor compare the PID the app reports with the one you recorded.
- Stop only recorded PIDs. Then check the port is free.
