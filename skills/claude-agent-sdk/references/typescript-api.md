# TypeScript Agent SDK — API Reference

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

Bundles native Claude Code binary. If optional deps are skipped, set `pathToClaudeCodeExecutable`.

---

## query()

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

Returns a `Query` (extends `AsyncGenerator<SDKMessage, void>`).

## startup()

Pre-warm the CLI subprocess before a prompt is ready:

```typescript
function startup(params?: {
  options?: Options;
  initializeTimeoutMs?: number;
}): Promise<WarmQuery>;

interface WarmQuery extends AsyncDisposable {
  query(prompt: string | AsyncIterable<SDKUserMessage>): Query;
  close(): void;
}
```

## tool()

```typescript
function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
  extras?: { annotations?: ToolAnnotations }
): SdkMcpToolDefinition<Schema>;
```

## createSdkMcpServer()

```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance;
```

---

## Options

| Property | Type | Default | Description |
|---|---|---|---|
| `abortController` | `AbortController` | `new AbortController()` | Cancellation |
| `additionalDirectories` | `string[]` | `[]` | Extra accessible directories |
| `agent` | `string` | — | Agent name for main thread |
| `agents` | `Record<string, AgentDefinition>` | — | Subagent definitions |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | Enable bypass mode |
| `allowedTools` | `string[]` | `[]` | Auto-approved tools |
| `betas` | `SdkBeta[]` | `[]` | Beta features |
| `canUseTool` | `CanUseTool` | — | Permission callback |
| `continue` | `boolean` | `false` | Continue recent session |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `debug` | `boolean` | `false` | Debug mode |
| `debugFile` | `string` | — | Debug log file |
| `disallowedTools` | `string[]` | `[]` | Always-denied tools |
| `effort` | `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'` | `'high'` | Reasoning effort |
| `enableFileCheckpointing` | `boolean` | `false` | Track file changes |
| `env` | `Record<string, string \| undefined>` | `process.env` | Environment |
| `forkSession` | `boolean` | `false` | Fork instead of resume |
| `maxBudgetUsd` | `number` | — | Cost limit |
| `maxTurns` | `number` | — | Turn limit |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | MCP servers |
| `model` | `string` | CLI default | Model ID |
| `outputFormat` | `{ type: 'json_schema'; schema: JSONSchema }` | — | Structured output |
| `permissionMode` | `PermissionMode` | `'default'` | Permission handling |
| `persistSession` | `boolean` | `true` | Save to disk |
| `resume` | `string` | — | Session ID to resume |
| `settingSources` | `SettingSource[]` | — | Load project config |
| `systemPrompt` | `string \| SystemPromptPreset` | — | Custom system prompt |
| `thinking` | `ThinkingConfig` | `{ type: 'adaptive' }` | Thinking behavior |
| `toolConfig` | `{ askUserQuestion?: { previewFormat?: 'markdown' \| 'html' } }` | — | Tool-specific config (e.g. HTML previews for AskUserQuestion) |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | — | Available tools |

### SystemPromptPreset

```typescript
type SystemPromptPreset = {
  type: "preset";
  preset: "claude_code";
  append?: string;
  excludeDynamicSections?: boolean;
};
```

### ThinkingConfig

```typescript
type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budget_tokens: number }
  | { type: "disabled" };
```

---

## Query Object

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(tokens: number | null): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedAgents(): Promise<AgentInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  reconnectMcpServer(serverName: string): Promise<void>;
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>;
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
```

---

## Message Types

### SDKAssistantMessage

```typescript
type SDKAssistantMessage = {
  type: "assistant";
  uuid: UUID;
  session_id: string;
  message: BetaMessage; // from Anthropic SDK
  parent_tool_use_id: string | null;
  error?: SDKAssistantMessageError;
};
```

Content at `message.message.content` — array of text/tool_use blocks.

### SDKResultMessage

```typescript
type SDKResultMessage = {
  type: "result";
  subtype: "success" | "error_max_turns" | "error_max_budget_usd" | "error_during_execution" | "error_max_structured_output_retries";
  uuid: UUID;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;          // only on "success"
  stop_reason: string | null;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: Record<string, ModelUsage>;
  permission_denials: SDKPermissionDenial[];
  structured_output?: unknown;
};
```

### SDKSystemMessage

```typescript
type SDKSystemMessage = {
  type: "system";
  subtype: "init";
  uuid: UUID;
  session_id: string;
  agents?: string[];
  claude_code_version: string;
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  skills: string[];
};
```

### SDKUserMessage

```typescript
type SDKUserMessage = {
  type: "user";
  uuid?: UUID;
  session_id: string;
  message: MessageParam;
  parent_tool_use_id: string | null;
};
```

### Other Message Types

`SDKPartialAssistantMessage` (streaming partial content), `SDKCompactBoundaryMessage` (context compaction), `SDKStatusMessage`, `SDKHookStartedMessage`, `SDKHookProgressMessage`, `SDKHookResponseMessage`, `SDKToolProgressMessage`, `SDKRateLimitEvent`, `SDKTaskNotificationMessage` (background task complete), `SDKTaskStartedMessage`, `SDKTaskProgressMessage`, `SDKTaskUpdatedMessage`, `SDKPromptSuggestionMessage` (suggested follow-up prompts).

### V2 Session API (Experimental)

The `unstable_v2_*` API provides a session-holding client for TypeScript with separate `send()` and `stream()` methods — closer to Python's `ClaudeSDKClient` pattern. See the [TypeScript V2 preview docs](https://code.claude.com/docs/en/agent-sdk/typescript-v2-preview) and the `hello-world-v2` demo for usage.

---

## Permission Types

```typescript
type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto";

type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  }
) => Promise<PermissionResult>;

type PermissionResult =
  | { behavior: "allow"; updatedInput?: Record<string, unknown>; updatedPermissions?: PermissionUpdate[] }
  | { behavior: "deny"; message: string; interrupt?: boolean };
```

---

## AgentDefinition

```typescript
type AgentDefinition = {
  description: string;
  prompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;  // 'sonnet' | 'opus' | 'haiku' | 'inherit' | full ID
  skills?: string[];
  memory?: "user" | "project" | "local";
  mcpServers?: AgentMcpServerSpec[];
  initialPrompt?: string;
  maxTurns?: number;
  background?: boolean;
  effort?: "low" | "medium" | "high" | "xhigh" | "max" | number;
  permissionMode?: PermissionMode;
  criticalSystemReminder_EXPERIMENTAL?: string;
};
```

---

## Hook Types

```typescript
type HookEvent =
  | "PreToolUse" | "PostToolUse" | "PostToolUseFailure"
  | "Notification" | "UserPromptSubmit"
  | "SessionStart" | "SessionEnd" | "Stop"
  | "SubagentStart" | "SubagentStop"
  | "PreCompact" | "PermissionRequest"
  | "Setup" | "TeammateIdle" | "TaskCompleted"
  | "ConfigChange" | "WorktreeCreate" | "WorktreeRemove";

interface HookCallbackMatcher {
  matcher?: string;       // regex against tool name
  hooks: HookCallback[];
  timeout?: number;       // seconds, default 60
}

type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;

type HookJSONOutput = {
  decision?: "block";
  systemMessage?: string;
  continue?: boolean;
  async?: boolean;
  asyncTimeout?: number;
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
    additionalContext?: string;
  };
};
```

---

## MCP Server Config

```typescript
type McpServerConfig =
  | { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "sdk"; name: string; instance: McpServer };
```

---

## Tool Input Types

```typescript
type BashInput = { command: string; timeout?: number; description?: string; run_in_background?: boolean };
type FileReadInput = { file_path: string; offset?: number; limit?: number; pages?: string };
type FileWriteInput = { file_path: string; content: string };
type FileEditInput = { file_path: string; old_string: string; new_string: string; replace_all?: boolean };
type GlobInput = { pattern: string; path?: string };
type GrepInput = { pattern: string; path?: string; glob?: string; output_mode?: "content" | "files_with_matches" | "count" };
type AgentInput = { description: string; prompt: string; subagent_type: string; model?: string; run_in_background?: boolean; max_turns?: number; name?: string; mode?: PermissionMode; isolation?: "worktree" };
```

---

## Session Management

```typescript
function listSessions(options?: { dir?: string; limit?: number }): Promise<SDKSessionInfo[]>;
function getSessionMessages(sessionId: string, options?: { dir?: string; limit?: number; offset?: number }): Promise<SessionMessage[]>;
function getSessionInfo(sessionId: string, options?: { dir?: string }): Promise<SDKSessionInfo | undefined>;
function renameSession(sessionId: string, title: string, options?: { dir?: string }): Promise<void>;
function tagSession(sessionId: string, tag: string | null, options?: { dir?: string }): Promise<void>;
```

---

## Tool Annotations

```typescript
type ToolAnnotations = {
  readOnlyHint?: boolean;    // default false — enables parallel execution
  destructiveHint?: boolean; // default true
  idempotentHint?: boolean;  // default false
  openWorldHint?: boolean;   // default true
};
```
