# Generated inputs on the real code

Use this when no verifier runs on the language, or when you want the model's finding confirmed on the code itself. It is testing, not proof: it covers the runs the generator happened to produce. Say so in the report.

The rule: import the real module. Never test a hand copy of the function.

## fast-check with bun

Tested with fast-check 4.11.0 and `bun test` 1.4.4.

```bash
bun add --dev fast-check
```

A stateless property:

```ts
import { test } from 'bun:test';
import fc from 'fast-check';
import { contains } from './contains';

test('a string contains itself', () => {
  fc.assert(fc.property(fc.string(), (text) => contains(text, text)));
});
```

The predicate returns a boolean or asserts. Use `fc.asyncProperty` for async code.

## Sequences of steps: model-based commands

For ordering bugs, generate sequences of commands and run them against the real object. Each command has `check` (may it run now, judged from a small model), `run` (act on the real object, update the model, assert) and `toString` (how it reads in a counterexample).

```ts
import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { LeaseStore } from './lease';

type Model = { held: Map<string, number> };

class Acquire implements fc.Command<Model, LeaseStore> {
  constructor(readonly worker: string) {}
  check = () => true;
  run(model: Model, real: LeaseStore) {
    const token = real.acquire(this.worker);
    if (token !== null) model.held.set(this.worker, token);
  }
  toString = () => `acquire(${this.worker})`;
}

class Expire implements fc.Command<Model, LeaseStore> {
  check = () => true;
  run(_model: Model, real: LeaseStore) {
    real.expire();
  }
  toString = () => 'expire';
}

class Commit implements fc.Command<Model, LeaseStore> {
  constructor(readonly worker: string) {}
  check = (model: Readonly<Model>) => model.held.has(this.worker);
  run(model: Model, real: LeaseStore) {
    real.commit(this.worker, model.held.get(this.worker) as number);
    model.held.delete(this.worker);
    expect(real.commitCount()).toBeLessThanOrEqual(1);
  }
  toString = () => `commit(${this.worker})`;
}

const commands = [
  fc.constantFrom('a', 'b').map((w) => new Acquire(w)),
  fc.constant(new Expire()),
  fc.constantFrom('a', 'b').map((w) => new Commit(w)),
];

const run = (cmds: Iterable<fc.Command<Model, LeaseStore>>) => {
  const setup = () => ({ model: { held: new Map() }, real: new LeaseStore() });
  fc.modelRun(setup, cmds);
};

test('a job commits at most once', () => {
  fc.assert(fc.property(fc.commands(commands, { size: '+1' }), run));
});
```

`fc.asyncModelRun` runs async commands. `fc.scheduledModelRun` interleaves them, for races.

## Read a failure

With the fencing check removed from `LeaseStore.commit`, the run above printed:

```
error: Property failed after 9 tests
{ seed: -728014158, path: "8:7:5:11", endOnFailure: true }
Counterexample: [acquire(a),expire,acquire(b),commit(a),commit(b) /*replayPath="AJ/DT:S"*/]
```

The counterexample is already shrunk. Tell it as steps in the code's words: A takes the lease, the lease expires, B takes it, A commits with its stale token, B commits.

## Replay a failure

Pass the reported values back. A commands failure needs the `replayPath` too. Keep every other option of `fc.commands` as it was.

```ts
fc.assert(
  fc.property(fc.commands(commands, { size: '+1', replayPath: 'AJ/DT:S' }), run),
  { seed: -728014158, path: '8:7:5:11', endOnFailure: true },
);
```

Run here: this replays the one failing sequence against the broken store and passes against the fixed one. With `size: '+1'` dropped, fast-check stopped with `Unable to replay, got wrong path`. Passing only `{ seed }` reruns the whole failing run and finds the same counterexample.

Remove the replay arguments once the fix lands. A pinned seed checks one run forever.

## Bounds to report

- `numRuns` defaults to 100. Raise it for a check that guards a costly bug, and state the number.
- State the command set and the actors generated. A bug that needs three workers will not appear with two.
