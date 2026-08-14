import { useState, type FormEvent } from 'react'

export type AgentMessage = { role: 'user' | 'assistant' | 'tool'; content: string; pending?: boolean; error?: boolean }
export type AgentClient = (prompt: string, conversationId?: string) => Promise<{ conversationId: string; content: string }>

export function AgentChat({ client, initialMessages = [], title = 'Assistant' }: { client: AgentClient; initialMessages?: AgentMessage[]; title?: string }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  async function submit(event: FormEvent) {
    event.preventDefault(); const prompt = input.trim(); if (!prompt || loading) return
    setInput(''); setError(undefined); setMessages(value => [...value, { role: 'user', content: prompt }, { role: 'assistant', content: '', pending: true }]); setLoading(true)
    try { const response = await client(prompt, conversationId); setConversationId(response.conversationId); setMessages(value => [...value.slice(0, -1), { role: 'assistant', content: response.content }]) }
    catch (reason) { const message = reason instanceof Error ? reason.message : 'No se pudo completar la solicitud'; setError(message); setMessages(value => value.slice(0, -1)) }
    finally { setLoading(false) }
  }
  return <section aria-label={title} className="gm-agent-chat"><header><h2>{title}</h2></header><div role="log" aria-live="polite">{messages.map((message, index) => <p key={index} data-role={message.role} data-pending={message.pending}>{message.content || (message.pending ? 'Pensando…' : '')}</p>)}</div>{error && <p role="alert">{error}</p>}<form onSubmit={submit}><input aria-label="Mensaje" value={input} onChange={event => setInput(event.target.value)} disabled={loading} /><button type="submit" disabled={loading || !input.trim()}>{loading ? 'Enviando…' : 'Enviar'}</button></form></section>
}

export function AgentLauncher({ onOpen, label = 'Abrir asistente' }: { onOpen: () => void; label?: string }) { return <button type="button" aria-label={label} onClick={onOpen} className="gm-agent-launcher">✦</button> }
