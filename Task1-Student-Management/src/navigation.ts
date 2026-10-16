import type { Section } from './types'

const sections: Section[] = ['dashboard', 'students', 'teachers', 'classes', 'attendance', 'academics', 'fees']

export function sectionFromHash(hash: string): Section {
  const section = hash.startsWith('#/') ? hash.slice(2) : ''
  return sections.find((item) => item === section) ?? 'dashboard'
}
