import { expect, it } from 'vitest'
import { sectionFromHash } from './navigation'

it('restores valid sections and rejects unknown URL fragments', () => {
  expect(sectionFromHash('#/academics')).toBe('academics')
  expect(sectionFromHash('#/students')).toBe('students')
  expect(sectionFromHash('#/admin')).toBe('dashboard')
  expect(sectionFromHash('')).toBe('dashboard')
})
