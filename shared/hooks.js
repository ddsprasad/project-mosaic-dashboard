// Shared data-fetching hooks for KPI endpoints and the triage feed.
// Both the dashboard and the executive report talk to the same backend API
// (/api/kpi/:id and /api/triage), so these hooks live in shared/.
import { useState, useEffect, createContext } from 'react'

// Bumping this context value triggers a cache-busting refetch in every hook
// reading it (used by a global "Refresh" button).
export const RefreshContext = createContext(0)

export function useKpi(id, refreshKey = 0) {
  const [state, setState] = useState({ value: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    const url = refreshKey > 0 ? `/api/kpi/${id}?refresh=1&_=${refreshKey}` : `/api/kpi/${id}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setState({ value: d.value, loading: false, error: d.error ?? null }) })
      .catch((e) => { if (!cancelled) setState({ value: null, loading: false, error: e.message }) })
    return () => { cancelled = true }
  }, [id, refreshKey])
  return state
}

export function useTriage(refreshKey = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    const url = refreshKey > 0 ? `/api/triage?refresh=1&_=${refreshKey}` : `/api/triage`
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setState({ data: d, loading: false, error: d.error ?? null }) })
      .catch((e) => { if (!cancelled) setState({ data: null, loading: false, error: e.message }) })
    return () => { cancelled = true }
  }, [refreshKey])
  return state
}
