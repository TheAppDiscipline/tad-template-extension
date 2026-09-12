import { describe, it, expect } from 'vitest'
import type { Message } from '../src/lib/messaging'

describe('Message type contract', () => {
  it('narrows by discriminator', () => {
    const m: Message = { type: 'GET_STORAGE', key: 'foo' }
    if (m.type === 'GET_STORAGE') {
      expect(m.key).toBe('foo')
    }
  })

  it('SET_STORAGE carries value', () => {
    const m: Message = { type: 'SET_STORAGE', key: 'x', value: 42 }
    if (m.type === 'SET_STORAGE') {
      expect(m.value).toBe(42)
    }
  })
})
