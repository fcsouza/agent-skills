# Python Agent SDK — API Reference

## Installation

```bash
pip install claude-agent-sdk
# or
uv add claude-agent-sdk
```

---

## query()

One-off interactions. New session each call.

```python
async def query(
    *,
    prompt: str | AsyncIterable[dict[str, Any]],
    options: ClaudeAgentOptions | None = None,
    transport: Transport | None = None
) -> AsyncIterator[Message]
```

## ClaudeSDKClient

Continuous conversations. Maintains session state across calls.

```python
class ClaudeSDKClient:
    def __init__(self, options: ClaudeAgentOptions | None = None, transport: Transport | None = None)
    async def connect(self, prompt: str | AsyncIterable[dict] | None = None) -> None
    async def query(self, prompt: str | AsyncIterable[dict], session_id: str = "default") -> None
    async def receive_messages(self) -> AsyncIterator[Message]
    async def receive_response(self) -> AsyncIterator[Message]
    async def interrupt(self) -> None
    async def set_permission_mode(self, mode: str) -> None
    async def set_model(self, model: str | None = None) -> None
    async def rewind_files(self, user_message_id: str) -> None
    async def get_mcp_status(self) -> McpStatusResponse
    async def reconnect_mcp_server(self, server_name: str) -> None
    async def toggle_mcp_server(self, server_name: str, enabled: bool) -> None
    async def stop_task(self, task_id: str) -> None
    async def disconnect(self) -> None
```

Use as async context manager: `async with ClaudeSDKClient(options) as client:`

### query() vs ClaudeSDKClient

| Feature | `query()` | `ClaudeSDKClient` |
|---|---|---|
| Session | New each call | Reuses same |
| Multi-turn | Via resume/continue | Automatic |
| Streaming input | Yes | Yes |
| Interrupts | No | Yes |
| Best for | One-off tasks | Interactive apps |

---

## ClaudeAgentOptions

```python
@dataclass
class ClaudeAgentOptions:
    tools: list[str] | ToolsPreset | None = None
    allowed_tools: list[str] = field(default_factory=list)
    system_prompt: str | SystemPromptPreset | None = None
    mcp_servers: dict[str, McpServerConfig] | str | Path = field(default_factory=dict)
    permission_mode: PermissionMode | None = None
    continue_conversation: bool = False
    resume: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None
    disallowed_tools: list[str] = field(default_factory=list)
    model: str | None = None
    fallback_model: str | None = None
    output_format: dict[str, Any] | None = None
    cwd: str | Path | None = None
    cli_path: str | Path | None = None
    env: dict[str, str] = field(default_factory=dict)
    can_use_tool: CanUseTool | None = None
    hooks: dict[HookEvent, list[HookMatcher]] | None = None
    agents: dict[str, AgentDefinition] | None = None
    setting_sources: list[SettingSource] | None = None
    thinking: ThinkingConfig | None = None
    effort: Literal["low", "medium", "high", "max"] | None = None
    enable_file_checkpointing: bool = False
    fork_session: bool = False
    include_partial_messages: bool = False
    plugins: list[SdkPluginConfig] = field(default_factory=list)
    add_dirs: list[str | Path] = field(default_factory=list)
    extra_args: dict[str, str | None] = field(default_factory=dict)
    user: str | None = None
    sandbox: SandboxSettings | None = None
    session_store: SessionStore | None = None
    stderr: Callable[[str], None] | None = None
    max_buffer_size: int | None = None
    betas: list[SdkBeta] = field(default_factory=list)
```

### PermissionMode

```python
PermissionMode = Literal["default", "acceptEdits", "plan", "dontAsk", "bypassPermissions"]
```

### SystemPromptPreset

```python
class SystemPromptPreset(TypedDict):
    type: Literal["preset"]
    preset: Literal["claude_code"]
    append: NotRequired[str]
    exclude_dynamic_sections: NotRequired[bool]
```

### ThinkingConfig

```python
# Adaptive (default)
{"type": "adaptive"}
# Enabled with budget
{"type": "enabled", "budget_tokens": 20000}
# Disabled
{"type": "disabled"}
```

---

## Message Types

```python
Message = (
    UserMessage | AssistantMessage | SystemMessage | ResultMessage
    | StreamEvent | RateLimitEvent
    | TaskStartedMessage | TaskProgressMessage | TaskNotificationMessage
)
```

### UserMessage

```python
@dataclass
class UserMessage:
    content: str | list[ContentBlock]
    uuid: str | None = None
    parent_tool_use_id: str | None = None
    tool_use_result: dict[str, Any] | None = None
```

### AssistantMessage

```python
@dataclass
class AssistantMessage:
    content: list[ContentBlock]
    model: str
    parent_tool_use_id: str | None = None
    error: AssistantMessageError | None = None
    usage: dict[str, Any] | None = None
    message_id: str | None = None
```

### ResultMessage

```python
@dataclass
class ResultMessage:
    subtype: str   # "success", "error_max_turns", "error_max_budget_usd", "error_during_execution"
    duration_ms: int
    duration_api_ms: int
    is_error: bool
    num_turns: int
    session_id: str
    total_cost_usd: float | None = None
    usage: dict[str, Any] | None = None
    result: str | None = None              # only on "success"
    stop_reason: str | None = None
    structured_output: Any = None
    model_usage: dict[str, Any] | None = None
```

### SystemMessage

```python
@dataclass
class SystemMessage:
    subtype: str    # "init", "compact_boundary"
    data: dict[str, Any]
    uuid: str
    session_id: str
```

### StreamEvent

```python
@dataclass
class StreamEvent:
    uuid: str
    session_id: str
    event: dict[str, Any]
    parent_tool_use_id: str | None = None
```

### RateLimitEvent

```python
@dataclass
class RateLimitEvent:
    rate_limit_info: RateLimitInfo
    uuid: str
    session_id: str
```

### Task Messages

```python
@dataclass
class TaskStartedMessage(SystemMessage):
    task_id: str
    description: str
    tool_use_id: str | None = None

@dataclass
class TaskProgressMessage(SystemMessage):
    task_id: str
    progress: dict[str, Any]

@dataclass
class TaskNotificationMessage(SystemMessage):
    task_id: str
    status: str  # "completed" | "failed" | "stopped"
    output_file: str
    summary: str
```

---

## Content Blocks

```python
@dataclass
class TextBlock:
    text: str

@dataclass
class ThinkingBlock:
    thinking: str
    signature: str

@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict[str, Any]

@dataclass
class ToolResultBlock:
    tool_use_id: str
    content: str | list[dict[str, Any]] | None = None
    is_error: bool | None = None
```

---

## Permission Types

```python
CanUseTool = Callable[
    [str, dict[str, Any], ToolPermissionContext],
    Awaitable[PermissionResult]
]

@dataclass
class ToolPermissionContext:
    signal: Any | None = None
    suggestions: list[PermissionUpdate] = field(default_factory=list)

@dataclass
class PermissionResultAllow:
    behavior: Literal["allow"] = "allow"
    updated_input: dict[str, Any] | None = None
    updated_permissions: list[PermissionUpdate] | None = None

@dataclass
class PermissionResultDeny:
    behavior: Literal["deny"] = "deny"
    message: str = ""
    interrupt: bool = False
```

---

## AgentDefinition

```python
@dataclass
class AgentDefinition:
    description: str
    prompt: str
    tools: list[str] | None = None
    disallowedTools: list[str] | None = None   # camelCase (wire format)
    model: str | None = None
    skills: list[str] | None = None
    memory: Literal["user", "project", "local"] | None = None
    mcpServers: list[str | dict[str, Any]] | None = None
    initialPrompt: str | None = None
    maxTurns: int | None = None
    background: bool | None = None
    effort: Literal["low", "medium", "high", "max"] | int | None = None
    permissionMode: PermissionMode | None = None
```

---

## Hook Types

```python
HookEvent = Literal[
    "PreToolUse", "PostToolUse", "PostToolUseFailure",
    "UserPromptSubmit", "Stop",
    "SubagentStart", "SubagentStop",
    "PreCompact", "Notification", "PermissionRequest",
]

@dataclass
class HookMatcher:
    matcher: str | None = None   # regex against tool name
    hooks: list[HookCallback] = field(default_factory=list)
    timeout: float | None = None

# Callback signature
HookCallback = Callable[
    [dict, str | None, Any],     # (input_data, tool_use_id, context)
    Awaitable[dict]              # HookJSONOutput
]
```

### Hook Input Types

```python
class PreToolUseHookInput(TypedDict):
    hook_event_name: Literal["PreToolUse"]
    session_id: str
    cwd: str
    tool_name: str
    tool_input: dict[str, Any]
    tool_use_id: str
    agent_id: NotRequired[str]

class PostToolUseHookInput(TypedDict):
    hook_event_name: Literal["PostToolUse"]
    session_id: str
    cwd: str
    tool_name: str
    tool_input: dict[str, Any]
    tool_response: Any
    tool_use_id: str
```

### Hook Output

```python
class HookJSONOutput(TypedDict):
    decision: NotRequired[Literal["block"]]
    systemMessage: NotRequired[str]
    continue_: NotRequired[bool]         # "continue" is reserved in Python
    async_: NotRequired[bool]            # "async" is reserved in Python
    asyncTimeout: NotRequired[int]
    hookSpecificOutput: NotRequired[dict]
```

---

## @tool Decorator

```python
@tool(
    name: str,
    description: str,
    input_schema: type | dict[str, Any],   # dict shorthand or JSON Schema
    annotations: ToolAnnotations | None = None
)
async def handler(args: dict[str, Any]) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": "result"}]}
```

## create_sdk_mcp_server()

```python
def create_sdk_mcp_server(
    name: str,
    version: str = "1.0.0",
    tools: list[SdkMcpTool[Any]] | None = None
) -> McpSdkServerConfig
```

---

## MCP Config Types

```python
class McpStdioServerConfig(TypedDict):
    type: NotRequired[Literal["stdio"]]
    command: str
    args: NotRequired[list[str]]
    env: NotRequired[dict[str, str]]

class McpSSEServerConfig(TypedDict):
    type: Literal["sse"]
    url: str
    headers: NotRequired[dict[str, str]]

class McpHttpServerConfig(TypedDict):
    type: Literal["http"]
    url: str
    headers: NotRequired[dict[str, str]]
```

---

## Session Functions

```python
def list_sessions(directory: str | None = None, limit: int | None = None) -> list[SDKSessionInfo]
def get_session_messages(session_id: str, directory: str | None = None, limit: int | None = None, offset: int = 0) -> list[SessionMessage]
def get_session_info(session_id: str, directory: str | None = None) -> SDKSessionInfo | None
def rename_session(session_id: str, title: str, directory: str | None = None) -> None
def tag_session(session_id: str, tag: str | None, directory: str | None = None) -> None
```

---

## Error Types

```python
class ClaudeSDKError(Exception): ...
class CLINotFoundError(CLIConnectionError): ...
class CLIConnectionError(ClaudeSDKError): ...
class ProcessError(ClaudeSDKError):
    exit_code: int | None
    stderr: str | None
class CLIJSONDecodeError(ClaudeSDKError):
    line: str
    original_error: Exception
```
