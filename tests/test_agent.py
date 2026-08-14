import asyncio
import unittest
from decimal import Decimal

from gm_agent.conversation import AgentService, Conversation
from gm_agent.providers import ProviderResponse
from gm_billing import BillingService, InMemoryBillingStore, PricingRule
from gm_mcp import RequestContext, ToolRegistry, tool


class FakeProvider:
    name = "fake"

    def __init__(self):
        self.calls = 0

    async def complete(self, *, model, messages, tools):
        self.calls += 1
        if self.calls == 1:
            return ProviderResponse("", [{"id": "call-1", "name": "students.find", "arguments": '{"query":"Ana"}'}], 10, 2)
        return ProviderResponse("Encontré a Ana.", [], 12, 5)


class ProviderRequiringSafeNames:
    name = "fake"

    def __init__(self):
        self.calls = 0
        self.seen_tools = []

    async def complete(self, *, model, messages, tools):
        self.seen_tools.append([item["function"]["name"] for item in tools])
        self.calls += 1
        if self.calls == 1:
            return ProviderResponse("", [{"id": "call-1", "name": "ballet_alumnas_search", "arguments": '{"query":"Ana"}'}])
        return ProviderResponse("Respuesta con datos.", [])


class AgentTests(unittest.TestCase):
    def test_agent_routes_tools_and_captures_usage(self):
        registry = ToolRegistry()

        @tool(name="students.find", description="Find", input_schema={"type": "object"})
        def find(*, context, query):
            return {"query": query, "organization": context.organization_id}

        registry.register(find)
        billing = BillingService(InMemoryBillingStore(), [PricingRule("fake", "test", Decimal("1"), Decimal("2"))])
        service = AgentService(FakeProvider(), registry, billing)
        result = asyncio.run(service.respond(conversation=Conversation(), prompt="Busca Ana", context=RequestContext("u", "o", "p", frozenset({"read"})), model="test"))
        self.assertEqual(result.content, "Encontré a Ana.")
        self.assertEqual(len(billing.store.usage), 2)

    def test_openai_tool_message_shape_is_preserved(self):
        message = __import__("gm_agent.conversation", fromlist=["Message"]).Message(
            "assistant", "", tool_calls=[{"id": "call", "name": "students.find", "arguments": "{}"}]
        )
        value = message.as_provider_message()
        self.assertEqual(value["tool_calls"][0]["type"], "function")
        self.assertEqual(value["tool_calls"][0]["function"]["name"], "students.find")

    def test_namespaced_tools_use_safe_provider_aliases_and_keep_registry_names(self):
        registry = ToolRegistry()

        @tool(name="ballet.alumnas_search", description="Find", input_schema={"type": "object"})
        def find(*, context, query):
            return {"query": query}

        registry.register(find)
        provider = ProviderRequiringSafeNames()
        service = AgentService(provider, registry)
        result = asyncio.run(service.respond(conversation=Conversation(), prompt="Busca Ana", context=RequestContext("u", "o", "p", frozenset({"read"})), model="test"))
        self.assertEqual(result.content, "Respuesta con datos.")
        self.assertEqual(provider.seen_tools[0], ["ballet_alumnas_search"])
