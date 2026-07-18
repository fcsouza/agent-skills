# Advisor Tool

A Messages API beta feature that pairs a fast **executor** model with a higher-intelligence **advisor** for strategic guidance mid-generation. The executor decides when to call the advisor; Anthropic runs the advisor sub-inference server-side within the same `/v1/messages` request — no extra round-trip on your end.

**Use case:** long-horizon agentic workloads (coding agents, computer use, multi-step research) where most turns are mechanical but good plans are critical. You get close to advisor-solo quality while bulk token generation happens at executor-model rates.

**Platform availability:** Claude API and Claude Platform on AWS only. Not available on Amazon Bedrock, Google Cloud, or Microsoft Foundry.

**Beta header required:** `betas=["advisor-tool-2026-03-01"]`

## Quick Start

```python
import anthropic

client = anthropic.Anthropic()

response = client.beta.messages.create(
    model="claude-sonnet-5",          # executor
    max_tokens=4096,
    betas=["advisor-tool-2026-03-01"],
    tools=[{
        "type": "advisor_20260301",
        "name": "advisor",
        "model": "claude-fable-5",    # advisor (returns encrypted result)
        # Use "claude-opus-4-8" to get plaintext advice instead
    }],
    messages=[{"role": "user", "content": "Build a concurrent worker pool in Go."}],
)
```

## Tool Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `type` | string | required | Must be `"advisor_20260301"` |
| `name` | string | required | Must be `"advisor"` |
| `model` | string | required | Advisor model ID (see compatibility table below) |
| `max_uses` | integer | unlimited | Per-request cap on advisor calls. Exceeded calls return `advisor_tool_result_error` with `error_code: "max_uses_exceeded"` |
| `max_tokens` | integer | model cap | Caps advisor output (thinking + text) per call. Minimum 1024. Recommended: 2048 |
| `caching` | object\|null | null | Enable advisor-side prompt caching: `{"type": "ephemeral", "ttl": "5m" \| "1h"}`. Enable when ≥3 advisor calls expected per conversation |

## Result Variants

The `advisor_tool_result.content` field is a discriminated union based on the advisor model:

| Variant | Fields | When returned |
|---|---|---|
| `advisor_result` | `text`, `stop_reason?` | Advisor is a standard model (e.g. claude-opus-4-8) |
| `advisor_redacted_result` | `encrypted_content`, `stop_reason?` | Advisor is Fable 5 or Mythos 5 |

With `advisor_redacted_result`, `encrypted_content` is opaque — you cannot read it. The server decrypts it on the next turn so the executor sees the plaintext advice. Round-trip it verbatim in `messages`.

**ZDR note:** Claude Fable 5 and Claude Mythos 5 advisors are **not ZDR (zero data retention) eligible** and require 30-day data retention. Use `claude-opus-4-8` as the advisor if ZDR compliance is required.

## Model Compatibility

Advisor must be at least as capable as the executor. Invalid pairs return HTTP 400.

| Executor | Valid advisors (examples) |
|---|---|
| claude-haiku-4-5 | claude-sonnet-4-6, claude-opus-4-6, claude-opus-4-7, claude-opus-4-8, claude-fable-5, claude-mythos-5 |
| claude-sonnet-4-6 | claude-sonnet-4-6, claude-opus-4-6, claude-opus-4-7, claude-opus-4-8, claude-fable-5, claude-mythos-5 |
| claude-sonnet-5 | claude-opus-4-7, claude-opus-4-8, claude-fable-5, claude-mythos-5 |
| claude-opus-4-6 | claude-opus-4-6, claude-opus-4-7, claude-opus-4-8, claude-fable-5, claude-mythos-5 |
| claude-opus-4-7/4-8 | claude-opus-4-7, claude-opus-4-8, claude-fable-5, claude-mythos-5 |
| claude-fable-5 | claude-fable-5 only |
| claude-mythos-5 | claude-mythos-5 only |

Full table: [platform.claude.com/docs/.../advisor-tool#model-compatibility](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool#model-compatibility)

## How It Works

1. Executor emits a `server_tool_use` block (`name: "advisor"`, empty `input`)
2. Anthropic runs the advisor sub-inference server-side with the full executor transcript as context
3. Result appears as `advisor_tool_result` in the assistant's content
4. Executor continues generating, informed by the advice

In multi-turn conversations: always include all `advisor_tool_result` blocks in subsequent requests — omitting them causes HTTP 400. To stop using the advisor mid-conversation, remove it from `tools` **and** strip all `advisor_tool_result` blocks from history.

## Usage and Billing

Advisor tokens appear in `usage.iterations[]` with `"type": "advisor_message"`, billed at the advisor model's rates. Top-level `usage` reflects executor tokens only.

Typical advisor output: 400–700 text tokens, or 1,400–1,800 tokens including thinking. For hard reasoning tasks: 4,200–5,900 tokens (use `max_tokens: 2048` to control this).

## Agent SDK Compatibility

The advisor tool is a Messages API feature. As of July 2026, **it is not confirmed whether the Agent SDK's `query()` wires it when included in `betas`**. If you need the advisor in an SDK-based agent loop, verify via a spike, or call the Messages API directly for turns where advisor guidance is needed.

## Cost Control

- `max_uses`: per-request cap
- Conversation-level: count advisor calls client-side; remove advisor from `tools` + strip history blocks when you reach your ceiling
- `caching`: break-even at ~3 advisor calls per conversation; enable for long agent loops

## Suggested System Prompt (Coding Tasks)

Prepend these two blocks to the executor's system prompt for consistent advisor timing and 2–3 advisor calls per task:

**Timing block:**
```
You have access to an `advisor` tool backed by a stronger reviewer model. It takes NO parameters.

Call advisor BEFORE substantive work — before writing, before committing to an interpretation,
before building on an assumption. Orientation (reading files, searching) is not substantive.

Also call advisor: when you believe the task is complete; when stuck; when considering a change
of approach. On tasks longer than a few steps, call advisor at least once before committing
and once before declaring done.
```

**Advice-handling block:**
```
Give the advice serious weight. If empirical evidence contradicts it, surface the conflict in
one more advisor call rather than silently switching.
```
