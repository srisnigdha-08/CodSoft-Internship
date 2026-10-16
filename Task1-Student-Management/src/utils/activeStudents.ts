import { apiRequestPage } from '../api'
import type { Student } from '../types'

interface StudentPageMeta { pages: number }

// Forms need the complete authorized roster, not just the API's first page.
export async function loadActiveStudents(): Promise<Student[]> {
  const first = await apiRequestPage<Student[], StudentPageMeta>('/students?page=1&limit=50&status=active')
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, first.meta.pages - 1) }, (_, index) =>
      apiRequestPage<Student[], StudentPageMeta>(`/students?page=${index + 2}&limit=50&status=active`),
    ),
  )
  return [first.data, ...remaining.map((page) => page.data)].flat()
}
