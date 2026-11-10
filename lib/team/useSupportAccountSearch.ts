"use client"

import { useEffect, useState } from "react"
import { API_CLIENT_BASE } from "@/lib/route-map"

export interface SupportAccountResult {
  masterId: string
  masterName: string | null
  masterEmail: string
  teams: { id: string; name: string }[]
}

const SEARCH_DEBOUNCE_MS = 300
export const SUPPORT_SEARCH_MIN_LENGTH = 2

/** Busca contas de clientes (só o Manager do backoffice recebe resultado). */
export function useSupportAccountSearch(input: {
  enabled: boolean
  supabaseId: string | null
  query: string
}) {
  const { enabled, supabaseId, query } = input
  const [results, setResults] = useState<SupportAccountResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasError, setHasError] = useState(false)

  const normalized = query.trim()
  const shouldSearch = enabled && Boolean(supabaseId) && normalized.length >= SUPPORT_SEARCH_MIN_LENGTH

  useEffect(() => {
    if (!shouldSearch || !supabaseId) {
      setResults([])
      setIsSearching(false)
      setHasError(false)
      return
    }

    let cancelled = false
    setIsSearching(true)
    setHasError(false)

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_CLIENT_BASE}/teams/support-accounts?q=${encodeURIComponent(normalized)}`,
          { headers: { "x-supabase-user-id": supabaseId }, cache: "no-store" }
        )
        const output = await response.json()
        if (!response.ok || !output.isValid) throw new Error("support search failed")
        if (!cancelled) setResults(output.result ?? [])
      } catch (error) {
        console.error("[useSupportAccountSearch]", error)
        if (!cancelled) {
          setResults([])
          setHasError(true)
        }
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [shouldSearch, supabaseId, normalized])

  return { results, isSearching, hasError, shouldSearch }
}
