import { afterEach, expect, it, vi } from 'vitest'
import { loadActiveStudents } from './activeStudents'

afterEach(() => vi.unstubAllGlobals())

it('loads every active student page for management forms', async () => {
  const requestedPages: number[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const page = Number(new URL(String(input), 'http://localhost').searchParams.get('page'))
    requestedPages.push(page)
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: page }], meta: { pages: 3 } }),
    } as Response
  }))

  const students = await loadActiveStudents()
  expect(students.map((student) => student.id)).toEqual([1, 2, 3])
  expect(requestedPages.sort()).toEqual([1, 2, 3])
})
