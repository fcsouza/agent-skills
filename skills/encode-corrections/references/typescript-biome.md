# TypeScript, bun and Biome recipes

Concrete checks for a repo on TypeScript, bun and Biome through ultracite. Every config below ran on 2026-11-22 against Biome 2.6.8, ultracite 8.3.1, dependency-cruiser 18.8.0, TypeScript 6.0.3 and bun 1.4.4, in a scratch project, unless a line says otherwise. Biome's docs describe the 2.x line; option names changed between majors, so check the installed version (`biome --version`) before copying. Pages behind each claim: `sources.md`.

## Commands

- Read package.json for the repo's own lint and format scripts, for example `bun run format` and `bun run lint:biome`. Ultracite does not define those names.
- Run Biome through those scripts, not through bunx. Add a new check to an existing script, or add a script, so the same command runs locally and in CI.
- Ultracite itself provides `ultracite check` (reports, changes nothing) and `ultracite fix` (applies safe fixes).

## Extend ultracite's config

Ultracite ships Biome presets that a project extends. Add rules under `linter.rules` in the same file:

```jsonc
// biome.jsonc
{
  "extends": ["ultracite/biome/core"],
  "linter": {
    "rules": {
      "style": {
        // rules from the recipes below go here
      }
    }
  }
}
```

Other presets follow the pattern `ultracite/biome/<framework>`, such as `ultracite/biome/react`.

## Severity: use "error"

Biome rule levels are `"on"` (the rule's default severity), `"off"`, `"info"`, `"warn"` and `"error"`. Only errors make `biome lint` and `biome check` exit non-zero; warnings do so only with `--error-on-warnings`. `noRestrictedImports` and `noRestrictedGlobals` default to warning. Tested: with `"level": "on"`, a banned global printed a warning and the command exited 0. Every recipe here sets `"level": "error"`.

## Ban a name imported from a module

`noRestrictedImports` (group `style`). `paths` maps a module specifier to a message, or to an object with `importNames` and `message`:

```jsonc
"noRestrictedImports": {
  "level": "error",
  "options": {
    "paths": {
      "react": {
        "importNames": ["useEffect"],
        "message": "useEffect is banned in product code. Use useQuery from src/framework/data.ts or derive the value during render."
      }
    }
  }
}
```

Tested: `import { useEffect } from 'react'` failed with the message as the main line. `import { useState } from 'react'` passed.

## Ban a global

`noRestrictedGlobals` (group `style`). `deniedGlobals` is an object from name to message:

```jsonc
"noRestrictedGlobals": {
  "level": "error",
  "options": {
    "deniedGlobals": {
      "setTimeout": "Timers here patch over an ordering bug. Use schedule() from src/framework/time.ts, or fix the event order."
    }
  }
}
```

Tested: a bare `setTimeout(...)` failed. The main line reads "Do not use the global variable setTimeout." and the custom message prints as a note under it. `window.setTimeout(...)` did not fail. Catch the member form with a GritQL plugin (below).

## Allow the banned thing in one folder

`overrides` takes a list of `{ includes, linter }` blocks. A later matching override wins for a single-value setting.

```jsonc
"overrides": [
  {
    "includes": ["src/framework/**"],
    "linter": { "rules": { "style": { "noRestrictedImports": "off", "noRestrictedGlobals": "off" } } }
  }
]
```

Tested: the framework folder used `useEffect` and `setTimeout` with no error; product folders still failed.

Watch out: an override that sets a rule's `options` replaces the base options for those files; it does not merge them. Tested: an override that added a `patterns` entry to `noRestrictedImports` for `src/renderer/**` dropped the base `useEffect` ban in that folder. Repeat the base `paths` inside the override.

## Ban imports across a folder boundary

Biome can do part of this. `noRestrictedImports` `patterns` take gitignore-style globs, and an override scopes them to one folder:

```jsonc
{
  "includes": ["src/renderer/**"],
  "linter": {
    "rules": {
      "style": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": { "react": { "importNames": ["useEffect"], "message": "…same as the base rule…" } },
            "patterns": [
              { "group": ["**/main/**"], "message": "Renderer code may not import from src/main. Send a message over the IPC bridge in src/framework/ipc.ts." }
            ]
          }
        }
      }
    }
  }
}
```

Tested limit: the pattern matches the import text as written, not the resolved file. `'../main/disk'` and `'@app/main/disk'` failed. `'../main'` (the folder's index file) passed. A re-export through a third folder would pass too. The docs do not say which of the two it matches; this is observed behaviour.

For a boundary that must hold, use dependency-cruiser. It resolves each import to a file:

```js
// .dependency-cruiser.cjs
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'renderer-not-to-main',
      severity: 'error',
      comment: 'Renderer code may not import from src/main. Send a message over the IPC bridge in src/framework/ipc.ts.',
      from: { path: '^src/renderer/' },
      to: { path: '^src/main/' },
    },
  ],
  options: { tsPreCompilationDeps: true },
};
```

```json
"scripts": { "deps": "depcruise --config .dependency-cruiser.cjs --output-type err-long src" }
```

- Tested: both `'../main/disk'` and `'../main'` failed; the run exited 1.
- Use the `err-long` output type. It prints the rule's `comment`, so the comment is where the fix goes. Tested: the plain `err` type prints the rule name and the two files, not the comment.
- The `err` reporters exit with the number of `error`-severity violations.
- It needs a TypeScript compiler it supports. Without one it warned, cruised 0 modules and exited 0. A check that passes because it read nothing is the worst kind. Pin a supported TypeScript, and when you prove the rule, confirm the module count is above zero.
- `depcruise` is one of the package's bin names (with `dependency-cruiser` and `dependency-cruise`). `--validate` is an alias for `--config`.
- Path aliases: dependency-cruiser has an `options.tsConfig` setting for this. Not tested here.

## Ban a call shape with a GritQL plugin

Biome loads `.grit` files listed under `plugins`. Each entry is a path, or an object with `path` and `includes` to scope it:

```jsonc
"plugins": [{ "path": "./lint/no-member-set-timeout.grit", "includes": ["src/**"] }]
```

```grit
`$obj.setTimeout($args)` where {
  register_diagnostic(
    span = $obj,
    message = "Timers here patch over an ordering bug. Use schedule() from src/framework/time.ts, or fix the event order.",
    severity = "error"
  )
}
```

- `register_diagnostic` takes `span` and `message`, and optional `severity` (`hint`, `info`, `warn`, `error`) and `fix_kind`. Set `severity` to `"error"`; the default was not in the docs read.
- Tested: `window.setTimeout(...)` failed with the message. The diagnostic category printed as `plugin`.
- GritQL in Biome supports JavaScript and TypeScript, CSS and JSON. Biome's docs say support is still in progress and node names can change between versions. Prove the plugin again after a Biome upgrade.

## Exceptions on one line

```ts
// biome-ignore lint/style/noRestrictedGlobals: the vendor SDK polls only through a global timer.
setTimeout(poll, 1000);
```

- The text after the colon is required. Tested: `// biome-ignore lint/style/noRestrictedGlobals` with no reason is a parse error that fails the run.
- For a plugin hit, `// biome-ignore lint/plugin: <reason>` suppressed it in the test.
- Biome also has `biome-ignore-all` (whole file) and `biome-ignore-start` / `biome-ignore-end` (a range). Do not use either for an encoded rule.
- Biome reports a misplaced file-level suppression as `suppression/unused`.

## Branded types and parse at the boundary

Brand a primitive so values that mean different things cannot be swapped. Build the brand only through a function that checks it:

```ts
type OrgId = string & { readonly __brand: 'OrgId' };

const isOrgId = (input: string): input is OrgId => /^org_[a-z0-9]{12}$/.test(input);

export const parseOrgId = (input: string): OrgId => {
  if (!isOrgId(input)) {
    throw new Error(`Invalid org id: ${input}`);
  }
  return input;
};
```

- `input is OrgId` is a type predicate: when it returns true, TypeScript narrows the value. A predicate that does not really check is worse than a cast, because it hides the lie behind a safe-looking name.
- Never create a brand with `as`. A lint can enforce that: a GritQL pattern on `$x as OrgId` outside the parse file (not tested here).

When the repo already uses Zod, let the schema own the check and the type:

```ts
import { z } from 'zod';

const OrgId = z.string().regex(/^org_[a-z0-9]{12}$/).brand<'OrgId'>();
type OrgId = z.infer<typeof OrgId>;

const Invite = z.object({ orgId: OrgId, email: z.email() });
type Invite = z.infer<typeof Invite>;

export const parseInvite = (body: unknown): Invite => Invite.parse(body);
```

- The Zod brand is static only: `.parse` returns the same runtime value. Plain data is not assignable to the branded type until it goes through the schema.
- `.parse` throws a `ZodError`; `.safeParse` returns `{ success, data }` or `{ success, error }`. Use `safeParse` when failure is an expected branch.
- Do not add a schema library for one check. Use the one the repo has.
- `z.email()` is Zod 4 syntax. Check the installed Zod major.
- Tested: both brand snippets compiled with TypeScript 6.0.3 and Zod 4.6.7 under `--strict`, and passing a plain string where the brand was expected was a type error.

Parse where data enters: request handlers, queue consumers, env loading, `JSON.parse`, IPC. Inside, take the parsed type and drop repeat checks.

## Exhaustive switches

```ts
type Charge = { kind: 'pix'; key: string } | { kind: 'card'; token: string };

const describe = (charge: Charge) => {
  switch (charge.kind) {
    case 'pix':
      return `Pix ${charge.key}`;
    case 'card':
      return `Card ${charge.token}`;
    default: {
      const unreachable: never = charge;
      return unreachable;
    }
  }
};
```

Adding a variant to `Charge` makes the `never` assignment a type error at every `switch` that missed it. The TypeScript handbook documents the pattern. Tested: adding a third variant to a copy of this `switch` gave TS2322 on the `never` line and no other error.

## The ratchet

`scripts/ratchet.sh` in this skill counts lines that match a regex in the merge base and in the working tree, and fails when the count grew. It counts staged, unstaged and untracked files.

```json
"scripts": {
  "lint": "bun run lint:biome && scripts/ratchet.sh origin/main 'setTimeout\\(' 'Use schedule() from src/framework/time.ts.' src"
}
```

- Arguments: base ref, extended regex, the message, then pathspecs (default `.`).
- Tested in a scratch repo: no change passed; one added match failed whether untracked, unstaged or committed; a net removal passed; a bad ref or a bad regex exited 128 rather than passing.
- In CI the merge base must exist. A shallow clone may not have it; fetch the base branch with enough history.
- It counts lines, not occurrences, and matches text, so it also counts comments and strings. Pick a regex narrow enough for that to be fine, or use a GritQL plugin and count its diagnostics.
- Lower the count in the rule table as the cleanup lands. When it reaches zero, replace the ratchet with a plain lint ban.
- `biome lint --changed` is not a ratchet. It checks whole files that changed, so one edit in an old file fails on every old hit in it.

## Proving a check

1. Reintroduce the real past mistake in a scratch change: the bad import, the timer, the swapped id.
2. Run the exact script CI runs. Confirm it exits non-zero and the message names the fix.
3. Confirm the run read the files (module count, "Checked N files").
4. Drop the scratch change. Run the script again and confirm it passes.
