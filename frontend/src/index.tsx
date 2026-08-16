import { useState, type FormEvent } from 'react'

export type AgentConfirmation = { tool: string; arguments: Record<string, unknown>; intent_id?: string; confirmation_token?: string; idempotency_key?: string; expires_at?: string; status?: string }
export type AgentMessage = { role: 'user' | 'assistant' | 'tool'; content: string; pending?: boolean; error?: boolean; confirmation?: AgentConfirmation }
export type AgentResponse = { conversationId: string; content?: string; confirmation?: AgentConfirmation }
export type AgentClient = (prompt: string, conversationId?: string, confirmation?: AgentConfirmation) => Promise<AgentResponse>

export function AgentChat({ client, initialMessages = [], title = 'Assistant' }: { client: AgentClient; initialMessages?: AgentMessage[]; title?: string }) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  async function submit(event: FormEvent) {
    event.preventDefault(); const prompt = input.trim(); if (!prompt || loading) return
    setInput(''); setError(undefined); setMessages(value => [...value, { role: 'user', content: prompt }, { role: 'assistant', content: '', pending: true }]); setLoading(true)
    try { const response = await client(prompt, conversationId); setConversationId(response.conversationId); setMessages(value => [...value.slice(0, -1), response.confirmation ? { role: 'tool', content: 'Esta acción necesita confirmación.', confirmation: response.confirmation } : { role: 'assistant', content: response.content ?? '' }]) }
    catch (reason) { const message = reason instanceof Error ? reason.message : 'No se pudo completar la solicitud'; setError(message); setMessages(value => value.slice(0, -1)) }
    finally { setLoading(false) }
  }
  async function confirm(confirmation: AgentConfirmation) {
    setError(undefined); setLoading(true)
    try { const response = await client('', conversationId, confirmation); setConversationId(response.conversationId); setMessages(value => [...value, response.confirmation ? { role: 'tool', content: 'Esta acción necesita confirmación.', confirmation: response.confirmation } : { role: 'assistant', content: response.content ?? '' }]) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo confirmar la acción') }
    finally { setLoading(false) }
  }
  return <section aria-label={title} className="gm-agent-chat" style={{ width: 'min(100%, 42rem)', margin: '0 auto', display: 'grid', gap: 12, touchAction: 'manipulation' }}><header><h2>{title}</h2></header><div role="log" aria-live="polite">{messages.map((message, index) => <div key={index} data-role={message.role} data-pending={message.pending}><p>{message.content || (message.pending ? 'Pensando…' : '')}</p>{message.confirmation && <button type="button" style={{ minHeight: 44, padding: '10px 16px' }} onClick={() => void confirm(message.confirmation!)} disabled={loading}>Confirmar acción</button>}</div>)}</div>{error && <p role="alert">{error}</p>}<form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Mensaje" value={input} onChange={event => setInput(event.target.value)} disabled={loading} style={{ flex: '1 1 14rem', minHeight: 44 }} /><button type="submit" disabled={loading || !input.trim()} style={{ minHeight: 44, padding: '10px 16px' }}>{loading ? 'Enviando…' : 'Enviar'}</button></form></section>
}

export function AgentLauncher({ onOpen, label = 'Abrir asistente' }: { onOpen: () => void; label?: string }) { return <button type="button" aria-label={label} onClick={onOpen} className="gm-agent-launcher">✦</button> }
