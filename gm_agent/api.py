from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from gm_mcp import RequestContext

from .conversation import AgentService, Conversation


class ChatInput(BaseModel):
    conversation_id: str | None = None
    prompt: str
    user_id: str
    organization_id: str
    product_id: str
    permissions: set[str] = Field(default_factory=set)
    model: str = "gpt-4o-mini"


def create_app(service: AgentService) -> FastAPI:
    app = FastAPI(title="gm-agent", version="0.1.0")
    conversations: dict[str, Conversation] = {}

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/agent/chat")
    async def chat(payload: ChatInput) -> dict[str, str]:
        conversation = conversations.setdefault(payload.conversation_id or "", Conversation(id=payload.conversation_id or ""))
        context = RequestContext(payload.user_id, payload.organization_id, payload.product_id, frozenset(payload.permissions))
        message = await service.respond(conversation=conversation, prompt=payload.prompt, context=context, model=payload.model)
        return {"conversationId": conversation.id, "content": message.content}

    return app
