import { useEffect, useState, type FormEvent } from 'react'

export type AgentConfirmation = { tool: string; arguments: Record<string, unknown>; summary?: string; details?: string[]; intent_id?: string; confirmation_token?: string; idempotency_key?: string; expires_at?: string; status?: string }
export type AgentMessage = { role: 'user' | 'assistant' | 'tool'; content: string; pending?: boolean; error?: boolean; confirmation?: AgentConfirmation }
export type AgentResponse = { conversationId: string; content?: string; confirmation?: AgentConfirmation }
export type AgentClient = (prompt: string, conversationId?: string, confirmation?: AgentConfirmation) => Promise<AgentResponse>

export type PersistedChat = { conversationId?: string; messages: AgentMessage[] }

export function readPersistedChat(key: string | undefined, fallback: AgentMessage[]): PersistedChat {
  if (!key || typeof window === 'undefined') return { messages: fallback }
  try {
    const value = window.sessionStorage.getItem(key)
    if (!value) return { messages: fallback }
    const parsed = JSON.parse(value) as Partial<PersistedChat>
    if (!Array.isArray(parsed.messages) || !parsed.messages.every(message => message && ['user', 'assistant', 'tool'].includes(message.role) && typeof message.content === 'string')) return { messages: fallback }
    return { conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : undefined, messages: parsed.messages }
  } catch { return { messages: fallback } }
}

export function persistChat(key: string | undefined, state: PersistedChat) {
  if (!key || typeof window === 'undefined') return
  try {
    const messages = state.messages.filter(message => !message.pending).slice(-100).map(message => {
      if (!message.confirmation) return message
      const { confirmation_token: _token, idempotency_key: _key, intent_id: _intent, ...displayOnly } = message.confirmation
      return { ...message, confirmation: { ...displayOnly, status: 'confirmation_expired' } }
    })
    window.sessionStorage.setItem(key, JSON.stringify({ conversationId: state.conversationId, messages }))
  } catch { /* Chat remains usable when browser storage is unavailable or full. */ }
}

export function clearAgentChat(key: string | undefined) {
  if (!key || typeof window === 'undefined') return
  try { window.sessionStorage.removeItem(key) } catch { /* Ignore unavailable browser storage. */ }
}

export function AgentChat({ client, initialMessages = [], title = 'Assistant', persistenceKey }: { client: AgentClient; initialMessages?: AgentMessage[]; title?: string; persistenceKey?: string }) {
  const [restored] = useState(() => readPersistedChat(persistenceKey, initialMessages))
  const [messages, setMessages] = useState(restored.messages)
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>(restored.conversationId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => { persistChat(persistenceKey, { conversationId, messages }) }, [persistenceKey, conversationId, messages])
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
  return <section aria-label={title} className="gm-agent-chat" style={{ width: 'min(100%, 42rem)', margin: '0 auto', display: 'grid', gap: 12, touchAction: 'manipulation' }}><header><h2>{title}</h2></header><div role="log" aria-live="polite">{messages.map((message, index) => <div key={index} data-role={message.role} data-pending={message.pending}><p>{message.content || (message.pending ? 'Pensando…' : '')}</p>{message.confirmation && <div role="group" aria-label="Confirmación de operación" style={{ border: '1px solid currentColor', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}><strong>{message.confirmation.summary || 'Revisa la operación antes de ejecutarla.'}</strong>{message.confirmation.details?.map((detail, detailIndex) => <p key={detailIndex} style={{ margin: 0 }}>{detail}</p>)}{message.confirmation.status === 'confirmation_expired' ? <small>La confirmación anterior venció. Solicita la acción otra vez para revisarla.</small> : <button type="button" style={{ minHeight: 44, padding: '10px 16px' }} onClick={() => void confirm(message.confirmation!)} disabled={loading}>Confirmar y ejecutar</button>}</div>}</div>)}</div>{error && <p role="alert">{error}</p>}<form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input aria-label="Mensaje" value={input} onChange={event => setInput(event.target.value)} disabled={loading} style={{ flex: '1 1 14rem', minHeight: 44 }} /><button type="submit" disabled={loading || !input.trim()} style={{ minHeight: 44, padding: '10px 16px' }}>{loading ? 'Enviando…' : 'Enviar'}</button></form></section>
}

export function AgentLauncher({ onOpen, label = 'Abrir asistente' }: { onOpen: () => void; label?: string }) { return <button type="button" aria-label={label} onClick={onOpen} className="gm-agent-launcher">✦</button> }
