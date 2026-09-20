'use client'

import * as React from 'react'
import type { GridPaginationModel } from '@mui/x-data-grid'
import { replacePaginationSearchParams } from '@/lib/pagination'
import type { ActionResponse } from '@/types'

export type ServerPage<TRow> = {
  rows: TRow[]
  rowCount: number
}

export interface UseServerPaginationOptions<TRow, TFilters> {
  // The page the server component already rendered — used as initial state and
  // never refetched on mount.
  initialPage: ServerPage<TRow>
  initialPaginationModel: GridPaginationModel
  initialFilters: TFilters
  // Called for every user-driven page, page-size, filter, or reload change.
  fetchPage: (
    model: GridPaginationModel,
    filters: TFilters,
  ) => Promise<ActionResponse<ServerPage<TRow>>>
  // Optional: mirror the active filters into the URL alongside page/pageSize.
  syncFilterParams?: (params: URLSearchParams, filters: TFilters) => void
  errorMessage?: string
}

export interface UseServerPaginationResult<TRow, TFilters> {
  rows: TRow[]
  rowCount: number
  paginationModel: GridPaginationModel
  filters: TFilters
  isLoading: boolean
  error: Error | null
  onPaginationModelChange: (model: GridPaginationModel) => void
  onFiltersChange: (filters: TFilters) => void
  reload: () => void
}

/**
 * Clamp a requested page onto the last page that actually exists for `rowCount`.
 */
function clampModel(model: GridPaginationModel, rowCount: number): GridPaginationModel {
  const lastPage = rowCount > 0 ? Math.ceil(rowCount / model.pageSize) - 1 : 0
  return model.page > lastPage ? { ...model, page: lastPage } : model
}

/**
 * Server-side pagination for a DataGrid backed by a read action.
 *
 * Behaviour the individual lists used to re-implement (and get subtly wrong):
 * - The server-rendered first page is never refetched on mount.
 * - Only user-driven changes fetch, so React StrictMode's double mount is a no-op.
 * - Out-of-order responses are discarded, so rapid page/page-size changes cannot
 *   paint an older page over a newer one.
 * - A page that no longer exists (e.g. the last row on it was archived, or the URL
 *   asked for page 99) is clamped back to the last valid page instead of rendering
 *   an empty grid.
 * - page/pageSize (and optionally filters) stay mirrored in the URL, so reload,
 *   back, and share all preserve the view.
 */
export default function useServerPagination<TRow, TFilters>({
  initialPage,
  initialPaginationModel,
  initialFilters,
  fetchPage,
  syncFilterParams,
  errorMessage = 'Failed to load data.',
}: UseServerPaginationOptions<TRow, TFilters>): UseServerPaginationResult<TRow, TFilters> {
  const initialModel = clampModel(initialPaginationModel, initialPage.rowCount)

  const [rows, setRows] = React.useState<TRow[]>(initialPage.rows)
  const [rowCount, setRowCount] = React.useState(initialPage.rowCount)
  const [paginationModel, setPaginationModel] = React.useState(initialModel)
  const [filters, setFilters] = React.useState(initialFilters)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const [reloadToken, setReloadToken] = React.useState(0)

  // Latest-value refs so callers can pass inline callbacks without re-running the
  // fetch effect on every render.
  const fetchPageRef = React.useRef(fetchPage)
  const syncFilterParamsRef = React.useRef(syncFilterParams)

  React.useEffect(() => {
    fetchPageRef.current = fetchPage
    syncFilterParamsRef.current = syncFilterParams
  })

  // Only user-driven changes fetch; the mount render already has server data. The
  // exception is an out-of-range initial page, which must be corrected on mount.
  const hasInteractedRef = React.useRef(initialModel.page !== initialPaginationModel.page)
  const requestIdRef = React.useRef(0)

  const writeSearchParams = React.useCallback(
    (model: GridPaginationModel, nextFilters: TFilters) => {
      if (typeof window === 'undefined') return

      const url = new URL(window.location.href)
      syncFilterParamsRef.current?.(url.searchParams, nextFilters)
      const withPagination = replacePaginationSearchParams(
        `${url.origin}${url.pathname}${url.search}${url.hash}`,
        model,
      )
      window.history.replaceState(window.history.state, '', withPagination)
    },
    [],
  )

  const onPaginationModelChange = React.useCallback(
    (model: GridPaginationModel) => {
      hasInteractedRef.current = true
      setPaginationModel(model)
      writeSearchParams(model, filters)
    },
    [filters, writeSearchParams],
  )

  const onFiltersChange = React.useCallback(
    (nextFilters: TFilters) => {
      hasInteractedRef.current = true
      // A filter change invalidates the current offset — go back to page one.
      const model = { page: 0, pageSize: paginationModel.pageSize }
      setFilters(nextFilters)
      setPaginationModel(model)
      writeSearchParams(model, nextFilters)
    },
    [paginationModel.pageSize, writeSearchParams],
  )

  const reload = React.useCallback(() => {
    hasInteractedRef.current = true
    setReloadToken((token) => token + 1)
  }, [])

  React.useEffect(() => {
    if (!hasInteractedRef.current) return undefined

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    let active = true

    setIsLoading(true)
    setError(null)

    void (async () => {
      try {
        const result = await fetchPageRef.current(paginationModel, filters)
        // Discard anything superseded by a newer request.
        if (!active || requestId !== requestIdRef.current) return

        if (!result.success) {
          throw new Error(result.error ?? errorMessage)
        }

        const nextRows = result.data?.rows ?? []
        const nextRowCount = result.data?.rowCount ?? 0
        const clamped = clampModel(paginationModel, nextRowCount)

        // The requested page no longer exists (rows were archived out from under
        // it). Clamp and let this effect re-run against the valid page.
        if (clamped.page !== paginationModel.page) {
          setRowCount(nextRowCount)
          setPaginationModel(clamped)
          writeSearchParams(clamped, filters)
          return
        }

        setRows(nextRows)
        setRowCount(nextRowCount)
      } catch (err) {
        if (active && requestId === requestIdRef.current) {
          setError(err as Error)
        }
      } finally {
        if (active && requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [paginationModel, filters, reloadToken, errorMessage, writeSearchParams])

  return {
    rows,
    rowCount,
    paginationModel,
    filters,
    isLoading,
    error,
    onPaginationModelChange,
    onFiltersChange,
    reload,
  }
}
