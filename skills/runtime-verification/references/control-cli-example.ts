#!/usr/bin/env bun
// Control CLI for verifying Notes. Run from the repo root. Every command prints JSON.
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const HELP = `control-notes <command> [--run ID]

Commands (all print JSON; exit 1 on failure):
  up [--port N]                start Notes on a free port with a fresh data dir, seed two notes, wait until the page renders
  doctor                       read-only: is this run's instance alive, ours, and serving the Notes page?
  browser <step>...            drive the page in headless Chromium; steps run in order:
                                 goto <path>          open a path, e.g. goto /
                                 fill <label> <text>  type into the field with that label
                                 click <name>         click the button with that accessible name
                                 expect <text>        fail unless the page shows this text
                                 absent <text>        fail if the page shows this text
                                 within <list> <text> fail unless the list with that accessible name holds the text
                                 snap <name>          save <name>.png and <name>.aria.txt to evidence
  cli [--save NAME] -- <args>  run the notes CLI against this run's data dir; --save writes NAME.cli.json to evidence
  evidence                     list this run's evidence files
  down [--dry-run]             stop the process this run started and delete its data dir; evidence stays

Run ID: --run, else $VERIFY_RUN, else "main". Two runs with different IDs do not share port or data.
State:    $TMPDIR/verify-notes/runs/<run>/state.json   (deleted by down)
Evidence: $TMPDIR/verify-notes/evidence/<run>/         (never deleted by this tool)`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    run: { type: 'string', default: process.env.VERIFY_RUN ?? 'main' },
    port: { type: 'string' },
    save: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const root = join(tmpdir(), 'verify-notes');
const runDir = join(root, 'runs', values.run);
const evidenceDir = join(root, 'evidence', values.run);
const stateFile = join(runDir, 'state.json');
type State = { pid: number; procStart: string; port: number; dataDir: string; log: string; repo: string; startedAt: string };

// Both exit, so code after a call never runs. The `never` type makes the compiler say so.
const print = (data: unknown, ok = true): never => {
  console.log(JSON.stringify(data, null, 2));
  process.exit(ok ? 0 : 1);
};
const fail = (error: string, hint: string): never => print({ ok: false, error, hint }, false);

const readState = (): State => {
  if (!existsSync(stateFile)) {
    fail(`no state for run "${values.run}"`, 'run `control-notes up` first, or pass the --run you used');
  }
  return JSON.parse(readFileSync(stateFile, 'utf8'));
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const health = async (port: number) => {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
    return (await res.json()) as { ok: boolean; pid: number; dataDir: string };
  } catch {
    return null;
  }
};
// A PID alone proves nothing after a crash or reboot: the OS reuses PIDs. The start time of the
// process does not change, so PID plus start time names the process this run started, whether or
// not its port answers yet.
const procStart = (pid: number) => Bun.spawnSync(['ps', '-o', 'lstart=', '-p', String(pid)]).stdout.toString().trim();
const owned = (s: State) => s.procStart !== '' && procStart(s.pid) === s.procStart;
const freePort = () => {
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const { port } = probe;
  probe.stop(true);
  return port ?? fail('could not find a free port', 'pass --port N');
};
const runCli = (args: string[], dataDir: string) => {
  const proc = Bun.spawnSync(['bun', 'src/cli.ts', ...args], { env: { ...process.env, NOTES_DATA_DIR: dataDir } });
  return { command: `notes ${args.join(' ')}`, exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
};

const up = async () => {
  if (existsSync(stateFile) && owned(readState())) {
    fail(`run "${values.run}" is already up`, 'run `control-notes doctor`, or `down` first, or pick another --run');
  }
  if (!existsSync('src/server.ts')) {
    fail('src/server.ts not found', 'run this from the Notes repo root');
  }
  // No live instance of this run: drop whatever a crash or a failed seed left, so the data dir is fresh.
  rmSync(runDir, { recursive: true, force: true });
  const port = values.port ? Number(values.port) : freePort();
  const dataDir = join(runDir, 'data');
  const log = join(runDir, 'server.log');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(evidenceDir, { recursive: true });
  const seeds = [
    runCli(['add', '--title', 'Quarterly plan', '--body', 'Draft budget'], dataDir),
    runCli(['add', '--title', 'Grocery list', '--body', 'Eggs and milk'], dataDir),
  ];
  if (seeds.some((s) => s.exitCode !== 0)) {
    fail('seeding failed', JSON.stringify(seeds));
  }
  // One append handle for both streams. Two handles on one file overwrite each other's lines.
  const logFd = openSync(log, 'a');
  // Spawn the server directly: `bun run dev` is a wrapper whose PID is not the one holding the port.
  const proc = Bun.spawn(['bun', 'src/server.ts'], {
    env: { ...process.env, PORT: String(port), NOTES_DATA_DIR: dataDir },
    stdout: logFd,
    stderr: logFd,
  });
  proc.unref();
  const state: State = { pid: proc.pid, procStart: procStart(proc.pid), port, dataDir, log, repo: resolve('.'), startedAt: new Date().toISOString() };
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  for (let i = 0; i < 50; i++) {
    const page = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.text()).catch(() => '');
    if (page.includes('<h1>Notes</h1>') && page.includes('Quarterly plan')) {
      print({ ok: true, run: values.run, url: `http://127.0.0.1:${port}/`, ...state, evidenceDir });
    }
    await Bun.sleep(100);
  }
  fail('Notes did not render within 5 s', `read ${log}, then run \`control-notes down\``);
};

const doctor = async () => {
  const s = readState();
  const h = await health(s.port);
  const checks = {
    processAlive: alive(s.pid),
    portAnswers: h !== null,
    portOwnedByRun: h?.pid === s.pid,
    dataDirMatches: h?.dataDir === s.dataDir,
    pageRenders: (await fetch(`http://127.0.0.1:${s.port}/`).then((r) => r.text()).catch(() => '')).includes('<h1>Notes</h1>'),
  };
  const ok = Object.values(checks).every(Boolean);
  print({ ok, run: values.run, url: `http://127.0.0.1:${s.port}/`, pid: s.pid, checks, hint: ok ? undefined : 'run `control-notes down`, then `up`' }, ok);
};

const browser = async (steps: string[]) => {
  const s = readState();
  const launch = async () => {
    try {
      const { chromium } = await import('playwright');
      return await chromium.launch();
    } catch (e) {
      return fail(`could not start Chromium: ${(e as Error).message}`, 'run `bunx playwright install chromium`');
    }
  };
  const b = await launch();
  const page = await b.newPage();
  // Fail in seconds, not Playwright's 30 s default, so a renamed control shows up fast.
  page.setDefaultTimeout(5000);
  const done: unknown[] = [];
  try {
    for (let i = 0; i < steps.length; ) {
      const op = steps[i++];
      if (op === 'goto') {
        const path = steps[i++];
        await page.goto(`http://127.0.0.1:${s.port}${path}`);
        done.push({ goto: path, url: page.url() });
      } else if (op === 'fill') {
        const [label, text] = [steps[i++], steps[i++]];
        await page.getByLabel(label, { exact: true }).fill(text);
        done.push({ fill: label, text });
      } else if (op === 'click') {
        const name = steps[i++];
        await page.getByRole('button', { name, exact: true }).click();
        await page.waitForLoadState();
        done.push({ click: name, url: page.url() });
      } else if (op === 'expect' || op === 'absent') {
        const text = steps[i++];
        const shown = (await page.locator('body').innerText()).includes(text);
        if (shown !== (op === 'expect')) {
          throw new Error(`${op} "${text}" failed on ${page.url()}`);
        }
        done.push({ [op]: text });
      } else if (op === 'within') {
        const [list, text] = [steps[i++], steps[i++]];
        const region = page.getByRole('list', { name: list, exact: true });
        const inside = (await region.count()) > 0 && (await region.innerText()).includes(text);
        if (!inside) {
          throw new Error(`within "${list}" "${text}" failed on ${page.url()}: the list is missing or lacks the text`);
        }
        done.push({ within: list, text });
      } else if (op === 'snap') {
        const name = steps[i++];
        mkdirSync(evidenceDir, { recursive: true });
        await page.screenshot({ path: join(evidenceDir, `${name}.png`), fullPage: true });
        writeFileSync(join(evidenceDir, `${name}.aria.txt`), `url: ${page.url()}\n${await page.locator('body').ariaSnapshot()}\n`);
        done.push({ snap: name });
      } else {
        throw new Error(`unknown step "${op}"; see control-notes --help`);
      }
    }
  } catch (e) {
    await b.close();
    print({ ok: false, run: values.run, steps: done, error: (e as Error).message, hint: 'run `control-notes doctor` before driving again' }, false);
  }
  await b.close();
  print({ ok: true, run: values.run, steps: done });
};

const cli = (args: string[]) => {
  const s = readState();
  const result = runCli(args, s.dataDir);
  if (values.save) {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, `${values.save}.cli.json`), JSON.stringify(result, null, 2));
  }
  print({ ok: result.exitCode === 0, run: values.run, ...result }, result.exitCode === 0);
};

const down = async () => {
  const s = readState();
  // Signal the PID only while it is still the process this run started. Otherwise the PID is stale
  // and may now belong to another program.
  const running = owned(s);
  const plan = { stop: s.pid, running, stalePid: !running && alive(s.pid), remove: runDir, keep: evidenceDir };
  if (values['dry-run']) {
    print({ ok: true, dryRun: true, ...plan });
  }
  if (running) {
    process.kill(s.pid, 'SIGTERM');
    for (let i = 0; i < 30 && alive(s.pid); i++) {
      await Bun.sleep(100);
    }
  }
  const stillAlive = running && alive(s.pid);
  const portFree = (await health(s.port)) === null;
  if (!stillAlive) {
    rmSync(runDir, { recursive: true, force: true });
  }
  const ok = !stillAlive && portFree;
  print({ ok, ...plan, stopped: !stillAlive, portFree, evidence: existsSync(evidenceDir) ? readdirSync(evidenceDir) : [], hint: ok ? (plan.stalePid ? `pid ${s.pid} now belongs to another process; it was not signalled` : undefined) : `pid ${s.pid} or port ${s.port} still busy; check with \`lsof -i :${s.port}\`` }, ok);
};

const [cmd, ...rest] = positionals;
if (values.help || !cmd) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}
switch (cmd) {
  case 'up':
    await up();
    break;
  case 'doctor':
    await doctor();
    break;
  case 'browser':
    await browser(rest);
    break;
  case 'cli':
    cli(rest);
    break;
  case 'evidence':
    print({ ok: true, run: values.run, evidenceDir, files: existsSync(evidenceDir) ? readdirSync(evidenceDir).sort() : [] });
    break;
  case 'down':
    await down();
    break;
  default:
    fail(`unknown command "${cmd}"`, 'run control-notes --help');
}
