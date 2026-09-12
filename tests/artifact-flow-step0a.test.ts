import { describe, expect, it } from 'vitest'
import { STEP_ASSEMBLY_MAP, VALID_STEPS } from '../tools/discipline/lib/artifact-flow.js'

describe('Step 0a artifact flow', () => {
  it('uses 0a consistently for the step ID and paste-ready filename', () => {
    expect(VALID_STEPS).toContain('0a')
    expect(VALID_STEPS).not.toContain('0.1')
    expect(STEP_ASSEMBLY_MAP['0a']).toMatchObject({
      step: '0a',
      outputFile: 'step-0a-input.md',
    })
  })
})
