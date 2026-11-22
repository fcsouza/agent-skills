#!/usr/bin/env bun
// Usage: bun dot-to-mermaid.ts <states.dot> <view.ts>
// Reads a TLC state graph dump (-dump dot,actionlabels) and prints a Mermaid
// stateDiagram-v2 in the reader's words, then the shortest path to each
// state that breaks a rule.
//
// The view module exports:
//   state(vars)  -> the label of the chart state for a model state
//   step(action) -> the label of the arrow for a TLC action, or null to hide it
//   breaks(vars) -> the rule a model state breaks, or null
// `vars` maps each TLA+ variable name to its value as TLC prints it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Vars = Record<string, string>;
type View = {
  state: (vars: Vars) => string;
  step: (action: string) => string | null;
  breaks: (vars: Vars) => string | null;
};

const [dotPath, viewPath] = process.argv.slice(2);
if (!(dotPath && viewPath)) {
  console.error('usage: bun dot-to-mermaid.ts <states.dot> <view.ts>');
  process.exit(2);
}
const view: View = await import(resolve(viewPath));

const nodes = new Map<string, { vars: Vars; initial: boolean }>();
const edges: { from: string; to: string; action: string }[] = [];
for (const line of readFileSync(dotPath, 'utf8').split('\n')) {
  const edge = line.match(/^(-?\d+) -> (-?\d+) \[label="([^"]*)"/);
  if (edge) {
    edges.push({ from: edge[1], to: edge[2], action: edge[3] });
    continue;
  }
  const node = line.match(/^(-?\d+) \[label="(.*)"(,style = filled)?\];?$/);
  if (!node) continue;
  const vars: Vars = {};
  for (const part of node[2].split('\\n')) {
    const pair = part.match(/^\/\\\\ (\w+) = (.*)$/);
    if (pair) vars[pair[1]] = pair[2];
  }
  nodes.set(node[1], { vars, initial: node[3] !== undefined });
}
if (nodes.size === 0) {
  console.error(`no states found in ${dotPath}; was it written with -dump dot,actionlabels?`);
  process.exit(1);
}

const labelOf = new Map<string, string>();
const rulesOf = new Map<string, Set<string>>();
const cleanIn = new Set<string>();
for (const [id, { vars }] of nodes) {
  const label = view.state(vars);
  labelOf.set(id, label);
  const rule = view.breaks(vars);
  if (rule) rulesOf.set(label, (rulesOf.get(label) ?? new Set()).add(rule));
  else cleanIn.add(label);
}

const ids = new Map<string, string>();
const idFor = (label: string) => {
  if (!ids.has(label)) ids.set(label, `s${ids.size}`);
  return ids.get(label) as string;
};

const out = ['stateDiagram-v2'];
out.push('    classDef breaks fill:#ffecee,stroke:#e72e3b,stroke-width:2px');
out.push('    classDef mayBreak fill:#fff3e6,stroke:#e8730c,stroke-width:2px');
const arrows = new Set<string>();
for (const [id, { initial }] of nodes) {
  if (initial) arrows.add(`    [*] --> ${idFor(labelOf.get(id) as string)}`);
}
for (const { from, to, action } of edges) {
  const a = labelOf.get(from);
  const b = labelOf.get(to);
  const text = view.step(action);
  if (!(a && b) || a === b || text === null) continue;
  arrows.add(`    ${idFor(a)} --> ${idFor(b)}: ${text}`);
}
for (const [label, id] of ids) out.push(`    ${id}: ${label}`);
out.push(...arrows);
for (const [label] of rulesOf) {
  out.push(`    class ${idFor(label)} ${cleanIn.has(label) ? 'mayBreak' : 'breaks'}`);
}
console.log(out.join('\n'));

// Shortest path to each broken rule, breadth-first over model states.
const next = new Map<string, { to: string; action: string }[]>();
for (const { from, to, action } of edges) {
  next.set(from, [...(next.get(from) ?? []), { to, action }]);
}
const cameFrom = new Map<string, { from: string; action: string } | null>();
const queue = [...nodes].filter(([, n]) => n.initial).map(([id]) => id);
for (const id of queue) cameFrom.set(id, null);
const found = new Map<string, string>();
for (let i = 0; i < queue.length; i++) {
  const id = queue[i];
  const rule = view.breaks((nodes.get(id) as { vars: Vars }).vars);
  if (rule && !found.has(rule)) found.set(rule, id);
  for (const { to, action } of next.get(id) ?? []) {
    if (cameFrom.has(to)) continue;
    cameFrom.set(to, { from: id, action });
    queue.push(to);
  }
}
for (const [rule, end] of found) {
  const steps: string[] = [];
  for (let at = end; cameFrom.get(at); at = (cameFrom.get(at) as { from: string }).from) {
    const { action } = cameFrom.get(at) as { action: string };
    steps.unshift(`${view.step(action) ?? action} -> ${labelOf.get(at)}`);
  }
  console.log(`\nBreaks "${rule}", shortest path:`);
  steps.forEach((s, n) => console.log(`${n + 1}. ${s}`));
}
if (found.size === 0) console.log('\nNo state breaks a rule.');
