# OpenClaw Memory System Reference

## File Structure

Memory lives as plain Markdown in the agent workspace (`~/.openclaw/workspace/`):

```
workspace/
├── MEMORY.md                    # Curated long-term memory (private sessions only)
└── memory/
    ├── 2025-01-15.md            # Daily append-only logs
    ├── 2025-01-16.md
    └── ...
```

- **`MEMORY.md`**: Durable facts, decisions, user preferences. Agent writes in private sessions.
- **`memory/YYYY-MM-DD.md`**: Day-to-day notes. Today + yesterday loaded at session start.
- Files are the source of truth — the model only "remembers" what persists to disk.
- Per-agent index: `~/.openclaw/memory/<agentId>.sqlite`

## Memory Tools

| Tool | Purpose | Returns on missing file |
|------|---------|------------------------|
| `memory_search` | Semantic vector recall (~400-token chunks, 80-token overlap) | `{ text: "", path }` |
| `memory_get` | Direct file/line-range reads (rejects paths outside memory dirs) | `{ text: "", path }` |

Search results include: snippet text (~700 char cap), file path, line range, score.

Writing: agent writes to `MEMORY.md` for durable facts, `memory/YYYY-MM-DD.md` for daily context.

## Vector Search Config

Location: `agents.defaults.memorySearch` in openclaw.json.

```jsonc
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true,
        "provider": "auto",           // auto | local | openai | gemini | voyage | mistral
        "extraPaths": [],             // index Markdown outside workspace
        "query": {
          "hybrid": {
            "vectorWeight": 0.7,
            "textWeight": 0.3,
            "mmr": { "enabled": true, "lambda": 0.7 },
            "temporalDecay": { "enabled": true, "halfLifeDays": 30 }
          }
        },
        "cache": { "enabled": true, "maxEntries": 50000 },
        "experimental": {
          "sessionMemory": false,     // index session transcripts
          "sources": ["memory"]       // ["memory", "sessions"]
        }
      }
    }
  }
}
```

**Provider auto-selection order**: local (if `modelPath` configured) → openai → gemini → voyage → mistral → disabled.

**Storage**: SQLite-backed embedding cache. Optional `sqlite-vec` extension for fast vector distance; falls back to JS cosine similarity. File-watch debouncing for auto-reindex.

## Hybrid Search

| Method | Strength | Use Case |
|--------|----------|----------|
| Vector | Semantic similarity | "machine running the gateway" matches "gateway host" |
| BM25 | Exact token matching | IDs, code symbols, error strings |

Merged: `finalScore = vectorWeight * vectorScore + textWeight * textScore`. Falls back to BM25-only if embeddings unavailable.

## Post-Processing

**MMR (Maximal Marginal Relevance)**: Reduces redundant snippets via Jaccard similarity. `lambda`: `1.0` = pure relevance, `0.0` = max diversity. Default: `0.7`.

**Temporal Decay**: `decayedScore = score * e^(-ln(2)/halfLifeDays * ageInDays)`. Default half-life: 30 days. **Evergreen files** (`MEMORY.md`, non-dated `memory/*.md`) never decay.

## Local Embeddings

```jsonc
{
  "memorySearch": {
    "provider": "local",
    "modelPath": "hf:ggml-org/embeddinggemma-300m-qat-q8_0-GGUF/..."
  }
}
```

Default model: ~600 MB GGUF, auto-downloaded on first load. Requires `pnpm approve-builds` for native build. Falls back to remote on failure if configured.

## QMD Backend

Local-first search sidecar combining BM25 + vectors + reranking:

```jsonc
{ "memory": { "backend": "qmd" } }
```

- Self-contained at `~/.openclaw/agents/<agentId>/qmd/`
- Auto-updates on boot + configurable interval (default 5min)
- Requires: QMD CLI, SQLite with extensions, Bun + `node-llama-cpp`
- macOS/Linux supported; Windows via WSL2
- Falls back to builtin SQLite on failure
- Config: `memory.qmd.*` (command, searchMode, refresh, limits, scope)

## Batch Indexing

For large corpora (OpenAI, Gemini, Voyage):
```jsonc
{ "memorySearch": { "remote": { "batch": { "enabled": true, "concurrency": 2 } } } }
```
Async processing via vendor batch APIs. Cheaper and faster than synchronous.

## Auto Memory Flush

Before context compaction, Gateway triggers a silent agentic turn:

```jsonc
{
  "compaction": {
    "memoryFlush": {
      "enabled": true,
      "softThresholdTokens": 4000,
      "reserveTokensFloor": 20000
    }
  }
}
```

Agent writes key context, responds `NO_REPLY` (invisible to user). One flush per compaction cycle. Skipped if workspace is `"ro"` or `"none"`.

## Session Memory (Experimental)

Index session transcripts alongside memory files:
```jsonc
{ "experimental": { "sessionMemory": true, "sources": ["memory", "sessions"] } }
```
Async indexing with delta thresholds (~100 KB, 50 messages).

## Citations

Optional source attribution in search results via `memory.citations` config.
