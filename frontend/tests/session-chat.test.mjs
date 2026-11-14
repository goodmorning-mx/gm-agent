import test from 'node:test'
import assert from 'node:assert/strict'
import { clearAgentChat, persistChat, readPersistedChat } from '../dist/index.js'

function storage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  }
}

test('restores the conversation and visible messages after a page reload', () => {
  globalThis.window = { sessionStorage: storage() }
  const chat = { conversationId: 'conversation-1', messages: [{ role: 'user', content: 'Hola' }, { role: 'assistant', content: '¿En qué te ayudo?' }] }
  persistChat('agent:user-1', chat)
  assert.deepEqual(readPersistedChat('agent:user-1', []), chat)
})

test('does not persist confirmation credentials and marks restored confirmations expired', () => {
  globalThis.window = { sessionStorage: storage() }
  persistChat('agent:user-1', { conversationId: 'conversation-1', messages: [{
    role: 'tool', content: 'Revisa', confirmation: {
      tool: 'schedule', arguments: { customer_id: 'customer-1' }, summary: 'Programar seguimiento',
      confirmation_token: 'secret-token', intent_id: 'intent-1', idempotency_key: 'idempotency-1',
    },
  }] })
  const serialized = window.sessionStorage.getItem('agent:user-1')
  assert.equal(serialized.includes('secret-token'), false)
  assert.equal(serialized.includes('idempotency-1'), false)
  const restored = readPersistedChat('agent:user-1', []).messages[0]
  assert.equal(restored.confirmation.status, 'confirmation_expired')
  assert.equal(restored.confirmation.confirmation_token, undefined)
})

test('keeps user histories isolated and supports deleting one user history at logout', () => {
  globalThis.window = { sessionStorage: storage() }
  persistChat('agent:user-1', { conversationId: 'one', messages: [] })
  persistChat('agent:user-2', { conversationId: 'two', messages: [] })
  clearAgentChat('agent:user-1')
  assert.equal(readPersistedChat('agent:user-1', []).conversationId, undefined)
  assert.equal(readPersistedChat('agent:user-2', []).conversationId, 'two')
})
