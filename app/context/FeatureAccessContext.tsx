"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useUserContext } from "./UserContext"
import { useTeamContext } from "./TeamContext"

interface FeatureAccessContextValue {
  slugs: string[]
  isLoading: boolean
  hasAccess: (slug: string) => boolean
  refresh: () => Promise<void>
}

const FeatureAccessContext = createContext<FeatureAccessContextValue | undefined>(undefined)

interface FeatureAccessProviderProps {
  children: ReactNode
}

export function FeatureAccessProvider({ children }: FeatureAccessProviderProps) {
  const { user } = useUserContext()
  const { activeTeamId } = useTeamContext()
  const [slugs, setSlugs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const lastRequestKeyRef = useRef<string>("")
  const inFlightRef = useRef(false)

  const fetchAccess = useCallback(
    async (force = false) => {
      if (!user?.supabaseId) {
        setSlugs([])
        setIsLoading(false)
        return
      }

      const requestKey = `${user.id}:${activeTeamId ?? "no-team"}`
      if (!force && lastRequestKeyRef.current === requestKey) {
        return
      }

      if (inFlightRef.current) return
      inFlightRef.current = true
      setIsLoading(true)

      try {
        const response = await fetch("/api/v1/features/access", {
          headers: activeTeamId ? { "x-team-id": activeTeamId } : undefined,
          cache: "no-store",
        })
        const output = await response.json()
        if (!output.isValid) {
          setSlugs([])
          return
        }

        setSlugs(Array.isArray(output.result?.slugs) ? output.result.slugs : [])
        lastRequestKeyRef.current = requestKey
      } catch (error) {
        console.error("[FeatureAccessContext] Erro ao carregar acesso:", error)
        setSlugs([])
      } finally {
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [activeTeamId, user?.id, user?.supabaseId]
  )

  useEffect(() => {
    void fetchAccess()
  }, [fetchAccess])

  const hasAccess = useCallback((slug: string) => slugs.includes(slug), [slugs])

  const value = useMemo<FeatureAccessContextValue>(
    () => ({
      slugs,
      isLoading,
      hasAccess,
      refresh: async () => {
        await fetchAccess(true)
      },
    }),
    [slugs, isLoading, hasAccess, fetchAccess]
  )

  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>
}

export function useFeatureAccess() {
  const context = useContext(FeatureAccessContext)
  if (!context) {
    throw new Error("useFeatureAccess must be used within FeatureAccessProvider")
  }
  return context
}

