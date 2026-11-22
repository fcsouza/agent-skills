# TLC from the command line

Facts here come from the TLA+ tools repository and its docs, listed in [sources.md](sources.md). The check and dump commands below were run with v1.7.4 on Java 21, on the model in [example-job-lease/README.md](example-job-lease/README.md). `-continue` and `-deadlock` were read from the docs and not run. Run `-help` on the version you pin and trust that output over this page.

## Get the tools

- TLC ships inside `tla2tools.jar`, attached to each release of `tlaplus/tlaplus` on GitHub.
- v1.7.4 is the latest stable release. v1.8.0 and `rolling` are marked pre-release.
- The tools need Java 11 or later.
- Pin one release. Record the version and the jar's checksum in the generated skill. Keep the jar out of git and say where the reader gets it.
- Check the download. Each release's notes list a SHA-1 per asset. For v1.7.4, `tla2tools.jar` is `bee4a54f3ee3d4afc347c3240ec2d9e93b075104`.

```bash
gh release download v1.7.4 --repo tlaplus/tlaplus --pattern tla2tools.jar
```

## Run a check

```bash
java -cp tla2tools.jar tlc2.TLC -config JobLease.cfg -workers 1 JobLease.tla
```

`java -jar tla2tools.jar` is an alias for `tlc2.TLC`.

| Option | Effect |
|---|---|
| `-config file` | The config file. Defaults to the spec's name with `.cfg`. |
| `-workers num` | Worker threads. Defaults to 1. `auto` picks by core count. |
| `-deadlock` | Do not check for deadlock. Same as `CHECK_DEADLOCK FALSE` in the config. |
| `-continue` | Keep going after a violation and report every one. |
| `-dump dot,actionlabels,colorize file.dot` | Write the reachable state graph as Graphviz. The options after `dot` are comma-separated: `actionlabels`, `colorize`, `snapshot`. |
| `-metadir dir` | Where TLC keeps its working files. Point it outside the repo. |
| `-help` | List every option. |

Use one worker for a small model. The output order is then stable between runs.

## The config file

```
SPECIFICATION Spec

CONSTANTS
    Workers = {w1, w2}
    NoOne = NoOne
    MaxToken = 3

INVARIANT
    AtMostOneCommit

CHECK_DEADLOCK
    FALSE
```

- `SPECIFICATION` names the temporal formula, by convention `Spec`. It is the minimum a config needs.
- `INVARIANT` and `PROPERTY` take named operators, not expressions. Several names may share one line, separated by commas.
- `CONSTANT name = value` sets a constant. `name = name` makes it a model value. `{a, b}` with bare identifiers is a set of model values.
- `CONSTRAINT` bounds the states TLC explores.
- `CHECK_DEADLOCK FALSE` turns deadlock checking off.

## Read the result

TLC prints one of these lines, and exits with a matching status (from `EC.java` at v1.7.4):

| Output | Exit status |
|---|---|
| `Model checking completed. No error has been found.` | 0 |
| `Deadlock reached.` | 11 |
| `Invariant <name> is violated.` | 12 |
| A temporal property is violated | 13 |
| The spec does not parse | 150 |
| The config does not parse | 151 |

TLC writes a `states` working folder next to the spec unless you pass `-metadir`. The dot dump has one line per state, labelled with every variable, and one line per step, labelled with the action name:

```
6630222020553671211 [label="/\\ token = 0\n/\\ held = ...",style = filled]
6630222020553671211 -> -5328595011431608567 [label="Acquire",color="black",fontcolor="black"];
```

After a violation TLC prints the trace: numbered states, each with the action that led to it and the value of every variable. That trace is the counterexample. Rewrite it as steps in the code's words before you show it to anyone.

## Write a spec that reads well in a trace

- Write `Next` as a disjunction of named actions, such as `Acquire(w) \/ Expire \/ Commit(w)`. TLC labels each step with the action's name. One unnamed formula labels every step `Next`.
- Put each `\E` disjunct in parentheses. `\E w \in Workers : A(w) \/ B` puts `B` inside the quantifier.
- A state with no step out is a deadlock to TLC, even when it is a correct end state. Add an action that is true only in end states and changes nothing, or turn deadlock checking off. Say which you did.
- Keep constants small. Two or three of each actor finds most ordering bugs. Report the sizes as the bound.
- Bound every counter with a constant or a `CONSTRAINT`.
