# Testing with Quench

Foundry's runtime depends on a fully initialized `game` object — actor collections, settings, sockets, the canvas. Headless unit tests against a stripped Foundry are impractical for anything beyond pure helper functions. The community answer is **Quench** (`@ethaks/fvtt-quench`), a Mocha/Chai test runner that lives **inside** a running Foundry world.

Quench gives you `describe` / `it` / `expect` working against the real `game`, real `Hooks`, real documents — at the cost of needing a browser to run them.

---

## Setup

1. Install the Quench module from the package browser, or drop a copy into `Data/modules/_quench/`.
2. Add it as a recommended dependency in your `module.json`:
   ```json
   "relationships": {
     "recommends": [{ "id": "_quench", "type": "module" }]
   }
   ```
3. Enable Quench in your test world. The "Quench" button appears at the bottom of the sidebar.

---

## Registering a Batch

A batch is one logical group of tests. Register it on the `quenchReady` hook:

```javascript
// scripts/tests/index.mjs
Hooks.on("quenchReady", (quench) => {
  quench.registerBatch(
    "my-module.data-model",
    (context) => {
      const { describe, it, expect, beforeEach, afterEach } = context;

      describe("HeroData schema", () => {
        let actor;

        beforeEach(async () => {
          actor = await Actor.create({
            name: "Test Hero",
            type: "my-module.hero",
            system: { health: 50 },
          });
        });

        afterEach(async () => {
          await actor?.delete();
        });

        it("computes maxHealth in prepareDerivedData", () => {
          expect(actor.system.maxHealth).to.be.a("number");
          expect(actor.system.maxHealth).to.be.at.least(actor.system.health);
        });

        it("rejects negative health on update", async () => {
          let threw = false;
          try {
            await actor.update({ "system.health": -1 });
          } catch {
            threw = true;
          }
          expect(threw).to.equal(true);
        });
      });
    },
    { displayName: "MyModule: Data Model" }
  );
});
```

Load the test file only when Quench is active so it doesn't bloat the production bundle:

```javascript
// scripts/main.mjs
Hooks.once("ready", async () => {
  if (game.modules.get("_quench")?.active) {
    await import("./tests/index.mjs");
  }
});
```

---

## Common Patterns

### Testing a Hook

```javascript
it("fires my-module.preDamage hook", async () => {
  let payload = null;
  const hookId = Hooks.on("my-module.preDamage", (data) => {
    payload = data;
  });
  try {
    await actor.applyDamage(10);
    expect(payload).to.deep.include({ amount: 10 });
  } finally {
    Hooks.off("my-module.preDamage", hookId);
  }
});
```

Always `Hooks.off` in `finally` — a leaked hook will pollute later tests.

### Testing a Sheet Render

```javascript
it("renders without throwing", async () => {
  const sheet = new MyActorSheet({ document: actor });
  await sheet.render(true);
  expect(sheet.rendered).to.equal(true);
  expect(sheet.element.querySelector(".my-module-header")).to.exist;
  await sheet.close();
});
```

Render-then-query is enough for a smoke test. Don't try to simulate user input here — that's better suited to manual testing.

### Testing a Dice Roll

```javascript
it("damage roll uses actor str modifier", async () => {
  await actor.update({ "system.abilities.str": 14 });
  const roll = await actor.rollDamage("longsword");
  expect(roll.formula).to.include("@abilities.str");
  expect(roll.total).to.be.a("number");
});
```

For deterministic rolls, use `Roll.evaluateSync({ maximize: true })` or stub `CONFIG.Dice.randomUniform`:

```javascript
const original = CONFIG.Dice.randomUniform;
CONFIG.Dice.randomUniform = () => 0.999; // forces max on each die
try {
  // ... your test
} finally {
  CONFIG.Dice.randomUniform = original;
}
```

### Mocking GM-Only Code

Real Quench runs as whatever user is logged in — usually GM. To test player-side code paths, monkey-patch `game.user.isGM`:

```javascript
const real = Object.getOwnPropertyDescriptor(User.prototype, "isGM");
Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
try {
  // ... test player path
} finally {
  if (real) Object.defineProperty(User.prototype, "isGM", real);
  else delete game.user.isGM;
}
```

### Async Lifecycle

Quench supports `async` test bodies natively. Always `await` document CRUD — Foundry returns Promises that resolve **after** hooks fire and the change reaches the database.

```javascript
it("creates an embedded item", async () => {
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: "Test Sword",
    type: "weapon",
  }]);
  expect(actor.items.get(item.id)).to.exist;
});
```

---

## Test Organization

```
my-module/
├── scripts/
│   └── tests/
│       ├── index.mjs           ← register all batches
│       ├── data-model.test.mjs
│       ├── sheets.test.mjs
│       └── hooks.test.mjs
```

Keep one batch per file, named after the area under test. The `index.mjs` imports them all and registers them under unique IDs.

---

## CI Strategy

Headless Foundry is hard. There's no official Docker image, the EULA restricts redistribution, and the launcher requires a license check on startup. **Don't try to run Quench in GitHub Actions.**

What you **can** automate in CI:

- Lint (`eslint`, `prettier`)
- Type-check (`tsc --noEmit` if using fvtt-types)
- Manifest validation (`jsonschema` against the official `module.json` schema)
- Unit-test pure helpers that don't touch `game` (use Vitest + a thin Foundry stub)
- Build the module zip and validate the output

Run Quench manually before each release. A short checklist in your repo (`docs/release-checklist.md`):

```
- [ ] Open Foundry test world
- [ ] Open Quench
- [ ] Run all batches → 0 failures
- [ ] Smoke-test sheet rendering for each subtype
- [ ] Verify migration on a copy of a v1.0 world
```

---

## Pure-Helper Vitest Setup (Optional CI Path)

For pure functions that don't touch Foundry globals, you can run plain Vitest in CI:

```javascript
// scripts/utils/dice.mjs
export function calculateModifier(score) {
  return Math.floor((score - 10) / 2);
}
```

```javascript
// scripts/utils/dice.test.mjs
import { describe, it, expect } from "vitest";
import { calculateModifier } from "./dice.mjs";

describe("calculateModifier", () => {
  it("returns -1 for 8", () => expect(calculateModifier(8)).toBe(-1));
  it("returns 0 for 10", () => expect(calculateModifier(10)).toBe(0));
  it("returns +5 for 20", () => expect(calculateModifier(20)).toBe(5));
});
```

Run with `bunx vitest run` (or `npx vitest run`) in GitHub Actions. Anything that imports `foundry.*` globals can't go here — keep helpers free of Foundry imports for testability.

---

## Pitfalls

1. **Tests leaving documents behind** — Always `afterEach` delete what `beforeEach` creates. Otherwise re-running tests duplicates entities.
2. **Leaking hooks** — Always `Hooks.off` in `finally`. A test that registers a hook and crashes leaves it active for the rest of the session.
3. **Assuming roll determinism** — `Roll.evaluate()` is non-deterministic. Stub `CONFIG.Dice.randomUniform` or assert on `>= min, <= max`.
4. **Real packs in tests** — Tests that load a 200-document compendium will be slow. Use `pack.getIndex()` (cheap) or a fixture pack with 5 entries.
5. **Cross-test state** — `game.settings` and `CONFIG` mutations persist. Save and restore them in `beforeEach`/`afterEach`.
6. **Trying to run Quench from the Foundry config screen** — Quench needs an active world. Tests run after `ready`, not `setup`.
