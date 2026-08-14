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
