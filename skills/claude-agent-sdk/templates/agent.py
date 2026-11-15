# Verified against: claude-agent-sdk 0.2.182 (2026-11-15)
# Headless Python agent: explicit allowlist, no prompts, caps, no inherited settings.
from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query


async def run_ci_agent(task: str, cwd: str) -> str:
    options = ClaudeAgentOptions(
        cwd=cwd,
        allowed_tools=["Read", "Glob", "Grep", "Edit"],
        permission_mode="dontAsk",
        setting_sources=[],
        max_turns=30,
        max_budget_usd=5,
    )
    async for message in query(prompt=task, options=options):
        if isinstance(message, ResultMessage):
            if message.subtype == "success":
                return message.result or ""
            raise RuntimeError(f"agent stopped: {message.subtype} (session {message.session_id})")
    raise RuntimeError("query ended without a result message")
