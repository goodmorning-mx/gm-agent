from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class ProviderResponse:
    content: str
    tool_calls: list[dict[str, Any]]
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0


class ChatProvider(Protocol):
    name: str

    async def complete(self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ProviderResponse: ...


class OpenAIProvider:
    name = "openai"

    def __init__(self, client: Any) -> None:
        self.client = client

    async def complete(self, *, model: str, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ProviderResponse:
        response = await self.client.chat.completions.create(model=model, messages=messages, tools=tools or None)
        choice = response.choices[0]
        calls = [{"id": call.id, "name": call.function.name, "arguments": call.function.arguments} for call in (choice.message.tool_calls or [])]
        usage = response.usage
        return ProviderResponse(
            content=choice.message.content or "",
            tool_calls=calls,
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
            cached_tokens=getattr(getattr(usage, "prompt_tokens_details", None), "cached_tokens", 0) or 0,
        )
