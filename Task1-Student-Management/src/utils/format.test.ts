import { expect, it } from 'vitest'
import { formatDate } from './format'

it('formats a date-only database value as its calendar day', () => {
  expect(formatDate('2010-04-12')).toContain('Apr 12, 2010')
})
