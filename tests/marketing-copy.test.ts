import { expect, it } from 'vitest'
import { splitDisplayWords } from '../src/components/marketing/motion'

it('preserves Chinese and English copy while keeping closing punctuation with its word', () => {
  for (const [text, locale] of [
    ['让每一份好奇，都有下一步。', 'zh-CN'],
    ['Small questions. Bigger possibilities.', 'en'],
    ['“你怎么想？”', 'zh-CN'],
  ]) {
    const words = splitDisplayWords(text, locale)
    expect(words.join('')).toBe(text)
    expect(words.some((word) => /^[，。！？,.!?]+$/.test(word))).toBe(false)
  }
})
