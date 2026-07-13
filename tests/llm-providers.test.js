import { describe, expect, it } from 'vitest'
import {
  ANTHROPIC_JSON_TOOL_NAME,
  buildAnthropicJsonRequest,
  buildGeminiJsonRequest,
  buildOpenAiJsonRequest,
} from '../tools/llm_providers/payloads.js'
import {
  buildOpenAiCompatibleJsonRequest,
  toChatCompletionsEndpoint,
} from '../tools/llm_providers/openai-compatible.js'

describe('LLM provider payloads', () => {
  it('use strict structured outputs when a schema is supplied', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['ok'],
      properties: { ok: { type: 'boolean' } },
    }

    const openai = buildOpenAiJsonRequest({ model: 'model', system: 'system', input: { ping: true }, responseSchema: schema })
    expect(openai.response_format.type).toBe('json_schema')
    expect(openai.response_format.json_schema.strict).toBe(true)
    expect(openai.response_format.json_schema.schema).toEqual(schema)

    const anthropic = buildAnthropicJsonRequest({ model: 'model', system: 'system', input: { ping: true }, responseSchema: schema, maxTokens: 256 })
    expect(anthropic.tool_choice.name).toBe(ANTHROPIC_JSON_TOOL_NAME)
    expect(anthropic.tools[0].input_schema).toEqual(schema)

    const gemini = buildGeminiJsonRequest({ system: 'system', input: { ping: true }, responseSchema: schema })
    expect(gemini.config.responseMimeType).toBe('application/json')
    expect(gemini.config.responseSchema).toEqual(schema)
  })

  it('keeps OpenAI json_object only as the no-schema compatibility fallback', () => {
    const request = buildOpenAiJsonRequest({ model: 'model', system: 'system', input: { ping: true } })

    expect(request.response_format).toEqual({ type: 'json_object' })
  })

  it('makes the compatible-provider output mode explicit', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['ok'],
      properties: { ok: { type: 'boolean' } },
    }

    const strict = buildOpenAiCompatibleJsonRequest({
      model: 'model', system: 'system', input: { ping: true }, responseSchema: schema,
      structuredOutput: 'json_schema', strictSchema: true,
    })
    expect(strict.response_format.json_schema.strict).toBe(true)
    expect(strict.response_format.json_schema.schema).toEqual(schema)

    const promptOnly = buildOpenAiCompatibleJsonRequest({
      model: 'model', system: 'system', input: { ping: true }, structuredOutput: 'prompt',
    })
    expect(promptOnly.response_format).toBeUndefined()
    expect(promptOnly.messages[0].content).toContain('Return JSON only')
    expect(toChatCompletionsEndpoint('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1/chat/completions')
  })
})
