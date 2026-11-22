# Draw the behaviour as a statechart

The chart shows how the system moves between states, in the words of the person who reads it. That reader decides whether the behaviour is right. They should not need the spec.

## Rules become invariants

Ask the reader for the rules in their words: "You never see Synced while you are offline." Write each rule as an `INVARIANT`. If the model has no variable for a rule, add the variable. Never weaken a rule to make it hold.

## Build the chart from the state graph

1. Run the check with a state graph dump. See [tlc.md](tlc.md) for the `-dump dot,actionlabels` option. The dot file holds one node per reachable state and one edge per step, labelled with its action. When a rule breaks, add `-continue`, or the dump stops at the first violation.
2. Write a view module next to the model. It exports `state(vars)`, the reader's label for a model state; `step(action)`, the reader's label for a TLC action, or `null` to hide it; and `breaks(vars)`, the rule a model state breaks, or `null`. `vars` maps each variable name to its value as TLC prints it. [example-job-lease/view.ts](example-job-lease/view.ts) is a worked one.
3. Run the script that ships with this skill:

```bash
bun scripts/dot-to-mermaid.ts states.dot view.ts
```

It merges model states that share a label, draws one arrow per distinct pair of labels and step label, drops steps that stay inside one label, marks the states that break a rule, and prints the shortest path to each broken rule. Copy the script next to the model so the generated skill can rerun it.

Rebuild the chart on every change to the model. Do not edit the Mermaid by hand.

## Labels

- Label a state with what the reader can see or cares about: "Paying", "Lease held, write pending". Keep variable names out.
- Label a step as the reader sees it happen: "you press play", "the lease expires". Do not name the code or the TLA+ action.
- When a step is only possible under a condition, end its label with the condition in brackets: `you press play [while the file loads]`.

## Mark what breaks

- A chart state where every model state behind it breaks a rule gets the class `breaks`.
- A chart state where only some do gets `mayBreak`. If that hides where a rule breaks, split the label.
- Do not merge two states that break different rules.
- Add a legend that names the rule behind each mark.

The script writes these classes and their `classDef` lines. [example-job-lease/README.md](example-job-lease/README.md) shows a chart it produced.

## Shortest path per rule

For each broken rule, give the shortest path from a start state to the breaking state, as numbered steps in reader labels. The script prints it after the chart, from a breadth-first search of the dump.

## Keep it readable

Aim for about 20 arrows. To get there:

1. Use coarser labels. Give one label to values that act the same.
2. Leave out a detail the reader does not need, such as a call in flight whose return changes nothing.
3. Hide steps the reader does not need, such as a reset every state has.

When you hide steps: keep every chart state reachable from a start state, keep at least one arrow out of each state that has a step out in the model, and hide all steps of an arrow or none. Keep every state on a bug path and every mark.

## Hand off

Give the chart and its Mermaid text to the person who decides. Add one line per bug: the rule, the reader's sentence for it, and the numbered path. Say which steps the chart hides and what the model leaves out. Give the command that rebuilds the chart.
