import { describe, expect, it } from 'vitest'
import { choicesFor, parseModelOutput, type DecisionContext } from './schema'

const context: DecisionContext = {
  cursorSpeed: 'still',
  distanceToCursor: 60,
  lastAction: null,
  secondsSinceLastAction: null,
  targets: [
    { id: 'btn-save', label: 'Save' },
    { id: 'screen-target', label: 'Invite (button in Chrome)' }
  ],
  lineLanguage: 'English'
}

const raw = (o: object): string => JSON.stringify(o)

describe('choicesFor', () => {
  it('offers BOO plus one EXPLODE per target', () => {
    expect(choicesFor(context)).toEqual(['BOO', 'EXPLODE:btn-save', 'EXPLODE:screen-target'])
  })

  it('offers only BOO when nothing can explode', () => {
    expect(choicesFor({ ...context, targets: [] })).toEqual(['BOO'])
  })
})

describe('parseModelOutput', () => {
  it('reads an EXPLODE with its line', () => {
    expect(
      parseModelOutput(
        raw({ choice: 'EXPLODE:btn-save', intensity: 0, line: 'Ooh, save what?' }),
        context
      )
    ).toEqual({
      ok: true,
      action: { type: 'EXPLODE', targetId: 'btn-save' },
      line: 'Ooh, save what?'
    })
  })

  it('drops the line for BOO', () => {
    expect(parseModelOutput(raw({ choice: 'BOO', intensity: 0.3, line: 'hi' }), context)).toEqual({
      ok: true,
      action: { type: 'BOO', intensity: 0.3 },
      line: ''
    })
  })

  it('rejects targets that were not offered', () => {
    expect(
      parseModelOutput(raw({ choice: 'EXPLODE:btn-other', intensity: 0, line: '' }), context)
    ).toEqual({
      ok: false,
      reason: 'invalid_target'
    })
  })

  it.each([
    ['not json', 'nope'],
    ['intensity out of range', raw({ choice: 'BOO', intensity: 1.5, line: '' })],
    ['unknown choice', raw({ choice: 'DANCE', intensity: 0, line: '' })],
    ['missing intensity', raw({ choice: 'BOO', line: '' })]
  ])('rejects %s', (_, input) => {
    expect(parseModelOutput(input, context)).toEqual({ ok: false, reason: 'parse_failed' })
  })

  it('cleans the line: emoji, quotes, first sentence, 5 words', () => {
    const line = (text: string): string => {
      const result = parseModelOutput(
        raw({ choice: 'EXPLODE:btn-save', intensity: 0, line: text }),
        context
      )
      return result.ok ? result.line : 'FAILED'
    }
    expect(line('"Ooh 👻 what is this?" Then more.')).toBe('Ooh what is this?')
    expect(line('one two three four five six seven')).toBe('one two three four five')
    expect(line('Delete everything?! Yes!')).toBe('Delete everything?!')
    expect(line('   ')).toBe('')
  })
})
