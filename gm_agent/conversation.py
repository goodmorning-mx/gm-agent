from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable
from uuid import uuid4

from gm_billing import BillingService
from gm_mcp import RequestContext, ToolCall, ToolRegistry

from .providers import ChatProvider


@dataclass(slots=True)
class Message:
    role: str
    content: str
    tool_call_id: str | None = None
    name: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    provider_name: str | None = None

    def as_provider_message(self) -> dict[str, Any]:
        result: dict[str, Any] = {"role": self.role, "content": self.content}
        if self.tool_call_id:
            result["tool_call_id"] = self.tool_call_id
        if self.name:
            result["name"] = self.provider_name or self.name
        if self.tool_calls:
            result["tool_calls"] = [
                {
                    "id": call["id"],
                    "type": "function",
                    "function": {"name": call["name"], "arguments": call["arguments"]},
                }
                for call in self.tool_calls
            ]
        return result


@dataclass(slots=True)
class Conversation:
    id: str = field(default_factory=lambda: str(uuid4()))
    messages: list[Message] = field(default_factory=list)


Confirmation = Callable[[str, dict[str, Any]], Awaitable[bool]]


class AgentService:
    def __init__(self, provider: ChatProvider, registry: ToolRegistry, billing: BillingService | None = None, confirmation: Confirmation | None = None) -> None:
        self.provider = provider
        self.registry = registry
        self.billing = billing
        self.confirmation = confirmation

    async def respond(self, *, conversation: Conversation, prompt: str, context: RequestContext, model: str) -> Message:
        conversation.messages.append(Message("user", prompt))
        for _ in range(8):
            registry_tools = self.registry.list()
            aliases = {_provider_tool_name(item["name"]): item["name"] for item in registry_tools}
            if len(aliases) != len(registry_tools):
                raise ValueError("MCP tool names collide after provider-safe normalization.")
            tools = [
                {"type": "function", "function": {"name": _provider_tool_name(item["name"]), "description": item["description"], "parameters": item["inputSchema"]}}
                for item in registry_tools
            ]
            response = await self.provider.complete(model=model, messages=[m.as_provider_message() for m in conversation.messages], tools=tools)
            if self.billing:
                self.billing.record_usage(product_id=context.product_id, organization_id=context.organization_id, user_id=context.user_id, provider=self.provider.name, model=model, input_tokens=response.input_tokens, output_tokens=response.output_tokens, cached_tokens=response.cached_tokens, request_id=context.request_id)
            if not response.tool_calls:
                message = Message("assistant", response.content)
                conversation.messages.append(message)
                return message
            conversation.messages.append(Message("assistant", response.content, tool_calls=response.tool_calls))
            for call in response.tool_calls:
                arguments = json.loads(call["arguments"] or "{}")
                registry_name = aliases.get(call["name"], call["name"])
                tool_call = ToolCall(registry_name, arguments)
                result = await self.registry.invoke(tool_call, context)
                if result.requires_confirmation:
                    if self.confirmation is None or not await self.confirmation(tool_call.name, arguments):
                        result = await self.registry.invoke(ToolCall(tool_call.name, arguments, confirmed=False), context)
                        conversation.messages.append(Message("tool", json.dumps({"status": "confirmation_required", "tool": tool_call.name}), tool_call_id=call["id"], name=tool_call.name, provider_name=call["name"]))
                        continue
                    result = await self.registry.invoke(ToolCall(tool_call.name, arguments, confirmed=True), context)
                conversation.messages.append(Message("tool", json.dumps(result.content, default=str), tool_call_id=call["id"], name=tool_call.name, provider_name=call["name"]))
        raise RuntimeError("Agent tool-call limit exceeded")


def _provider_tool_name(name: str) -> str:
    """Map namespaced MCP names to the provider's portable function-name grammar."""
    return re.sub(r"[^A-Za-z0-9_-]", "_", name)
