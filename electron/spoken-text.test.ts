import { describe, expect, it } from 'vitest'
import { spokenText } from './spoken-text'

describe('spokenText', () => {
  it('keeps short labels as they are, without extra spaces', () => {
    expect(spokenText('  Invite   collaborators ')).toBe('Invite collaborators')
  })

  it('cuts at word boundaries: 4 words or 30 characters', () => {
    expect(spokenText('Search for people using their GitHub username')).toBe(
      'Search for people using'
    )
    expect(spokenText('Collaborators repository administration')).toBe('Collaborators repository')
  })

  it('works the same for Korean words', () => {
    expect(spokenText('협업자를 초대하고 함께 작업하세요 지금 바로')).toBe(
      '협업자를 초대하고 함께 작업하세요'
    )
  })

  it('cuts a single overlong word by characters', () => {
    expect(spokenText('Supercalifragilisticexpialidocious-and-more')).toHaveLength(30)
  })

  it('accepts a custom limit', () => {
    expect(spokenText('a b c d e f', { maxWords: 2, maxChars: 99 })).toBe('a b')
  })
})
