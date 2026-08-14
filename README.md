# gm-agent

Reusable full-stack GoodMorning agent module. The backend provides provider
abstraction (OpenAI first, other providers implement `ChatProvider`),
conversation state, tool calling through `gm-mcp`, request context and
confirmation gates, and usage capture through `gm-billing`. Products pass their
existing `ToolRegistry` adapters and services; no product business logic lives
here.

The React package exports `AgentChat` and `AgentLauncher`. It is intentionally
unstyled and responsive by default so desktop, PWA, mobile, keyboard and touch
shells can provide product branding without copying chat logic.

```bash
pip install gm-agent
cd frontend && npm install && npm run build
```
