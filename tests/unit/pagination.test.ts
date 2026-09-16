import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  parsePaginationSearchParams,
  replacePaginationSearchParams,
} from '@/lib/pagination'

describe('parsePaginationSearchParams', () => {
  it('uses the shared default for missing or invalid values', () => {
    expect(parsePaginationSearchParams({})).toEqual({ page: 0, pageSize: DEFAULT_PAGE_SIZE })
    expect(parsePaginationSearchParams({ page: '-2', pageSize: '1000' })).toEqual({
      page: 0,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it.each(PAGE_SIZE_OPTIONS)('accepts the %i-row table option', (pageSize) => {
    expect(parsePaginationSearchParams({ page: '3', pageSize: String(pageSize) })).toEqual({
      page: 2,
      pageSize,
    })
  })
})

describe('replacePaginationSearchParams', () => {
  it('persists the selected page and page size while preserving other parameters', () => {
    expect(replacePaginationSearchParams(
      'https://example.test/patients?status=Active&page=1&pageSize=10',
      { page: 2, pageSize: 25 },
    )).toBe('/patients?status=Active&page=3&pageSize=25')
  })
})
