# Project layout, the Unity CLI and batch mode

Checked against Unity 6000.3 and Unity CLI 1.0.0 on 2026-11-14. Run `unity --help` for the command list of the CLI you have installed.

## Project layout

- `Assets/` holds the project's assets. Reserved folder names change how Unity treats their contents:
  - `Editor`: Editor scripts, not available in Player builds. Editor-only code lives here or in an editor-only assembly definition.
  - `Resources`: assets loaded by name from a script at runtime.
  - `StreamingAssets`: files available in their original format at runtime.
  - `Editor Default Resources` (assets Editor scripts load) and `Gizmos` (icons drawn in the Scene view).
  - Files and folders whose names start with `.` are ignored, except under `StreamingAssets`.
- Every asset and folder in `Assets` has a `.meta` file beside it. Commit both.
- From 6.5 the Editor writes its log to `<Project>/Logs/Editor.log` by default instead of one global file. CI scripts that read the log must follow.

## The Unity CLI

Install it standalone with the script on `https://unity.com/install.sh` (macOS, Linux), a Homebrew cask, winget, or `.deb`/`.rpm` packages; Unity Hub installs and updates it by default. It is free and needs no Unity AI subscription.

| Command | What it does |
|---|---|
| `unity install [version]` | Installs a Unity Editor version, optionally with modules. |
| `unity projects` | Lists, creates, clones and opens registered projects. |
| `unity build` | Builds a project in batch mode. `--list-targets`, `--list-profiles` and `--create-profile <target>` discover targets and create Unity 6 build profiles. |
| `unity test` | Runs Edit Mode and Play Mode tests through the Editor test runner and writes an NUnit report. |
| `unity run` | Runs a project in batch mode, or a registered Editor command headless with `--command`. `--log-file <path>` writes the Editor log. |
| `unity recompile` | Recompiles a running Editor's scripts and reports compile errors. `--strict` also fails on warnings. |
| `unity watch test` | Re-runs `unity test --affected` when files change. |
| `unity status` | Shows connected Editors: port, project path, version, process id, and Safe Mode with its compile errors. |
| `unity command`, `unity commands`, `unity list` | Forward a command to a connected Editor, or list what it exposes. |
| `unity mcp` | Starts an MCP server for agents that cannot run shell commands, or configures a client to use it. |
| `unity pipeline install` | Installs the Pipeline package that connects the CLI to a running Editor. |
| `unity license` | Lists, activates and returns licences on this machine. |

Rules from Unity's `unity-cli` skill (Unity Companion License; paraphrased):

- `unity run` and `unity test` manage `-batchmode`, `-quit` and `-projectPath` themselves. Do not forward them after `--`; the CLI refuses them.
- `unity test --mode EditMode` or `--mode PlayMode`; `--filter <pattern>`; `--report-format junit` for JUnit XML.
- `unity build --target <BuildTarget> --output-path <path>`, or `--profile "<name>"` for a build profile.
- Pass `--project-path <path>` whenever more than one Editor may be open. Without it the CLI targets the Editor whose project contains the current directory, and an Editor open on a sibling git worktree answers your commands. Run one Editor per worktree.
- Sign-in and licence activation need the user's yes. Ask; do not activate a licence on your own.
- An unfocused Editor or a locked desktop can freeze Play mode at frame 1 while `unity status` still reports it as ready.

Exit codes (Unity CLI reference):

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Usage error |
| 3 | Authentication failure |
| 4 | Configuration required |
| 6 | The operation failed; for `unity test`, the run did not finish (compile error, no licence, crash, timeout) |
| 7 | A Unity service or a running Editor could not be reached; safe to retry |
| 8 | `unity test` only: tests ran and some failed; do not retry |

In CI, retry `unity test` only on 6 or 7.

The CLI sends usage analytics, an anonymous usage count and crash reports, and checks for updates. `unity analytics opt-out` and the environment variables on Unity's "Turn off Unity CLI data collection" page stop them; set them on CI runners.

## Raw Editor arguments (no CLI)

| Argument | Rule |
|---|---|
| `-batchmode` | No dialogs, no human input. An exception in script code or another failed operation makes Unity exit with code 1. You cannot open a project in batch mode while an Editor has it open. |
| `-projectPath <path>` | The project to open. `-createProject <path>` makes an empty one; add `-cloneFromTemplate <template>` to start from a template. |
| `-buildTarget <name>` | Forces the target platform before import. |
| `-activeBuildProfile <path>` | Sets the build profile; its scripting defines apply before scripts compile. |
| `-executeMethod Class.Method` | Runs a static method once the project opens. To fail the run, throw (exit code 1) or call `EditorApplication.Exit` with a non-zero code. |
| `-logFile <path>` | Where the Editor log goes; `-` for the console. |
| `-quit` | Quits when the other commands finish. With `-runTests` it quits before the tests complete. With async code running it can hang; `-quitTimeout` sets the wait, 300 seconds by default. With the Accelerator cache server it needs `-cacheServerWaitForUploadCompletion`. |
| `-nographics` | No graphics device, for GPU-less machines. Output logs are off unless you pass `-logFile`. It cannot bake GI. |
| `-accept-apiupdate` | Runs the API Updater in batch mode. Without it the updater does not run, which can cause compile errors. |
| `-vcsMode "Visible Meta Files"` | Sets the version control mode. |

Tests without the CLI: `-batchmode -projectPath <path> -runTests -testPlatform EditMode -testResults <path>.xml`. `-testPlatform` takes `EditMode` (the default), `PlayMode`, or a build target to run in a Player. `-testfilter` and `-testCategory` narrow the run. Do not add `-quit`: the Test Framework page says it is not supported while tests run. The same page says Unity components under test have no common definition of exit codes, so read the result XML for the verdict.

A minimal build method for `-executeMethod` or `unity run`, written against Unity 6000.3. It lives in an `Editor` folder. The scene path and output are this project's; the API is `BuildPipeline.BuildPlayer` with `BuildPlayerOptions`, from the 6000.3 script reference.

```csharp
// Assets/Editor/CiBuild.cs - Unity 6000.3
using UnityEditor;
using UnityEditor.Build.Reporting;

public static class CiBuild
{
    public static void Linux()
    {
        var options = new BuildPlayerOptions
        {
            scenes = new[] { "Assets/Scenes/Main.unity" },
            locationPathName = "Build/Linux/Game.x86_64",
            target = BuildTarget.StandaloneLinux64,
        };
        var report = BuildPipeline.BuildPlayer(options);
        // A non-zero exit code is the only failure signal CI sees in batch mode.
        EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
```

## Driving a running Editor

The Unity Pipeline package (`com.unity.pipeline`, Unity 6.0 or later) exposes a local HTTP API into an open Editor; the CLI talks to it on localhost only. Set it up with `unity auth login` and `unity pipeline install` while the project is open in the Editor, then check with `unity pipeline editors`. The default server port in Unity's install example is 7800.

Use it for every change to a scene, GameObject, prefab or asset. Before such a change, run `unity status`. If no Editor is connected, ask the user to open one rather than editing files.
