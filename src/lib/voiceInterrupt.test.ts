import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INTERRUPT_COMMAND } from './voiceInterrupt.ts'

test('ordinary Portuguese answer text cannot bypass echo protection as an interrupt command', () => {
  for (const text of ['Não encontrei dados para esse período.', 'O faturamento no mês foi confirmado.',
    'Você pode cancelar essa campanha depois.', 'Eu sou o Jarvis e posso explicar.', 'não', 'no']) {
    assert.equal(INTERRUPT_COMMAND.test(text), false, text)
  }
})
test('explicit interruption remains immediate', () => {
  for (const text of ['pare', 'Jarvis, pare de falar', 'cancela!', 'silêncio', 'espere', 'stop', 'Jarvis']) {
    assert.equal(INTERRUPT_COMMAND.test(text), true, text)
  }
})
