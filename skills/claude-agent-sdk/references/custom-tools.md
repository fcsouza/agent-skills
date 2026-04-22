# Custom Tools — Claude Agent SDK

## Overview

Custom tools let you define functions Claude can call during a conversation. They run in-process via SDK MCP servers — no separate process needed.

**Flow:** Define with `tool()` → Bundle with `createSdkMcpServer()` → Pass to `mcpServers` option → Add to `allowedTools`.

---

## Defining Tools

### Python (@tool decorator)

```python
from claude_agent_sdk import tool
from typing import Any

@tool("get_weather", "Get current weather for a city", {"city": str})
async def get_weather(args: dict[str, Any]) -> dict[str, Any]:
    city = args["city"]
    # ... fetch weather data ...
    return {"content": [{"type": "text", "text": f"Weather in {city}: 72°F, sunny"}]}
```

### TypeScript (tool() with Zod)

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const getWeather = tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async (args) => {
    // args is typed: { city: string }
    return { content: [{ type: "text", text: `Weather in ${args.city}: 72°F, sunny` }] };
  }
);
```

---

## Input Schemas

### TypeScript — Always Zod

```typescript
{
  name: z.string().describe("User's name"),
  age: z.number().int().min(0),
  role: z.enum(["admin", "user", "guest"]),
  email: z.string().email().optional(),
  count: z.number().default(10),  // .default() makes it optional
}
```

Use `.describe()` for field documentation Claude sees. Use `.default()` for optional parameters.

### Python — Dict Shorthand

```python
{"name": str, "count": int, "latitude": float}
```

All keys are required. No support for enums, ranges, or optional fields.

### Python — Full JSON Schema

Use when you need enums, ranges, optional fields, or nested objects:

```python
{
    "type": "object",
    "properties": {
        "unit_type": {
            "type": "string",
            "enum": ["length", "temperature", "weight"],
            "description": "Category of unit",
        },
        "value": {"type": "number", "description": "Value to convert"},
    },
    "required": ["unit_type", "value"],
}
```

For optional params with dict schema: leave out of schema, mention in description, read with `args.get("param", default)`.

---

## Bundling into MCP Server

```python
# Python
from claude_agent_sdk import create_sdk_mcp_server

server = create_sdk_mcp_server(
    name="my-tools",
    version="1.0.0",
    tools=[tool_a, tool_b, tool_c],
)

options = ClaudeAgentOptions(
    mcp_servers={"my-tools": server},
    allowed_tools=["mcp__my-tools__*"],  # wildcard: all tools
)
```

```typescript
// TypeScript
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const server = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [toolA, toolB, toolC],
});

const options = {
  mcpServers: { "my-tools": server },
  allowedTools: ["mcp__my-tools__*"],
};
```

---

## Tool Naming Convention

Pattern: `mcp__{server_name}__{tool_name}`

Example: Server `"weather"` + tool `"get_temperature"` → `mcp__weather__get_temperature`

Wildcards in `allowedTools`: `"mcp__weather__*"` allows all tools from the server.

---

## Error Handling

| What happens | Result |
|---|---|
| Handler throws (uncaught) | Agent loop **stops**. `query()` fails. |
| Handler returns `is_error: True` | Agent loop **continues**. Claude sees error, can retry. |

Always catch errors inside handlers:

```python
@tool("fetch_data", "Fetch from API", {"url": str})
async def fetch_data(args):
    try:
        response = await httpx.AsyncClient().get(args["url"])
        if response.status_code != 200:
            return {
                "content": [{"type": "text", "text": f"Error: {response.status_code}"}],
                "is_error": True,
            }
        return {"content": [{"type": "text", "text": response.text}]}
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Failed: {str(e)}"}],
            "is_error": True,
        }
```

```typescript
async (args) => {
  try {
    const res = await fetch(args.url);
    if (!res.ok) {
      return { content: [{ type: "text", text: `Error: ${res.status}` }], isError: true };
    }
    return { content: [{ type: "text", text: await res.text() }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Failed: ${e}` }], isError: true };
  }
}
```

---

## Tool Annotations

Optional metadata about tool behavior. Fifth argument to `tool()`.

| Field | Default | Meaning |
|---|---|---|
| `readOnlyHint` | `false` | No side effects — enables parallel execution |
| `destructiveHint` | `true` | May perform destructive updates |
| `idempotentHint` | `false` | Safe to retry with same args |
| `openWorldHint` | `true` | Reaches systems outside process |

```python
@tool(
    "search_db", "Search database", {"query": str},
    annotations=ToolAnnotations(readOnlyHint=True)
)
```

```typescript
tool("search_db", "Search database",
  { query: z.string() },
  async (args) => { /* ... */ },
  { annotations: { readOnlyHint: true } }
);
```

Annotations are metadata, not enforcement. Keep them accurate to the handler.

---

## Returning Images

Return base64-encoded image data:

```python
import base64

return {
    "content": [{
        "type": "image",
        "data": base64.b64encode(image_bytes).decode("ascii"),
        "mimeType": "image/png",  # image/jpeg, image/webp, image/gif
    }]
}
```

```typescript
return {
  content: [{
    type: "image",
    data: Buffer.from(imageBytes).toString("base64"),
    mimeType: "image/png"
  }]
};
```

No URL field — fetch images in handler, encode as base64.

---

## Returning Resources

Embed content identified by URI:

```python
return {
    "content": [{
        "type": "resource",
        "resource": {
            "uri": "file:///tmp/report.md",   # label, not read by SDK
            "mimeType": "text/markdown",
            "text": "# Report\n...",           # actual content inline
        },
    }]
}
```

Use `text` for text content, `blob` (base64) for binary. Not both.

---

## Controlling Tool Availability

### `tools` option — what's in context

```python
# Only Read and Grep built-ins (removes all others)
tools=["Read", "Grep"]

# No built-ins at all (only MCP tools)
tools=[]
```

Omitting a tool from `tools` removes it from context — Claude never attempts it.

### `allowedTools` — auto-approved

Listed tools run without permission prompts. Unlisted tools still exist but need approval.

### `disallowedTools` — always denied

Denied tools stay visible but calls are rejected. Prefer `tools` over `disallowedTools` to remove built-ins.

---

## Multiple Servers

Multiple MCP servers coexist with independent namespaces:

```python
options = ClaudeAgentOptions(
    mcp_servers={
        "weather": weather_server,
        "database": db_server,
        "notifications": notify_server,
    },
    allowed_tools=[
        "mcp__weather__*",
        "mcp__database__query",     # only query, not write
        "mcp__notifications__send",
    ],
)
```

---

## Tool Search

For large tool sets (dozens of tools), use tool search to load on demand instead of preloading all definitions. Enabled by default. Reduces context consumption.

See [tool search docs](https://code.claude.com/docs/en/agent-sdk/tool-search) for configuration.
