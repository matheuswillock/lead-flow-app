"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useUserContext } from "./UserContext"
import { useTeamContext } from "./TeamContext"

interface UserRoleData {
  isMaster: boolean
  role: string
  functions: string[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  userTypeSlug: string
  memberProActive: boolean
  memberProExpiresAt: string | null
}

const DEFAULT_USER_ROLE: UserRoleData = {
  isMaster: false,
  role: "operator",
  functions: [],
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  userTypeSlug: "common",
  memberProActive: false,
  memberProExpiresAt: null,
}
const ACCESS_CACHE_TTL_MS = 60_000
const ACCESS_POLL_INTERVAL_MS = 60_000

interface FeatureAccessContextValue {
  slugs: string[]
  betaSlugs: string[]
  userRole: UserRoleData
  isLoading: boolean
  hasAccess: (slug: string) => boolean
  isBeta: (slug: string) => boolean
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
  const [betaSlugs, setBetaSlugs] = useState<string[]>([])
  const [userRole, setUserRole] = useState<UserRoleData>(DEFAULT_USER_ROLE)
  const [isLoading, setIsLoading] = useState(true)
  const lastRequestKeyRef = useRef<string>("")
  const lastFetchedAtRef = useRef<number>(0)
  const hasResolvedAccessRef = useRef(false)
  const inFlightRef = useRef(false)

  const fetchAccess = useCallback(
    async (force = false) => {
      if (!user?.supabaseId) {
        setSlugs([])
        setBetaSlugs([])
        setUserRole(DEFAULT_USER_ROLE)
        lastRequestKeyRef.current = ""
        lastFetchedAtRef.current = 0
        hasResolvedAccessRef.current = false
        setIsLoading(false)
        return
      }

      const requestKey = `${user.id}:${activeTeamId ?? "no-team"}`
      const isSameRequest = lastRequestKeyRef.current === requestKey
      const isFresh = Date.now() - lastFetchedAtRef.current < ACCESS_CACHE_TTL_MS
      if (!force && isSameRequest && isFresh) {
        return
      }

      if (inFlightRef.current) return
      inFlightRef.current = true
      if (!hasResolvedAccessRef.current) {
        setIsLoading(true)
      }

      try {
        const response = await fetch("/api/v1/features/access", {
          headers: activeTeamId ? { "x-team-id": activeTeamId } : undefined,
          cache: "no-store",
        })
        const output = await response.json()

        if (!output.isValid) {
          setSlugs([])
          setBetaSlugs([])
          setUserRole(DEFAULT_USER_ROLE)
          return
        }

        lastRequestKeyRef.current = requestKey
        lastFetchedAtRef.current = Date.now()
        setSlugs(Array.isArray(output.result?.slugs) ? output.result.slugs : [])
        setBetaSlugs(Array.isArray(output.result?.betaSlugs) ? output.result.betaSlugs : [])
        const rawRole = output.result?.userRole
        setUserRole(rawRole && typeof rawRole === "object" ? (rawRole as UserRoleData) : DEFAULT_USER_ROLE)
      } catch (error) {
        console.error("[FeatureAccessContext] Erro ao carregar acesso:", error)
        setSlugs([])
        setBetaSlugs([])
        setUserRole(DEFAULT_USER_ROLE)
      } finally {
        hasResolvedAccessRef.current = true
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [activeTeamId, user?.id, user?.supabaseId]
  )

  useEffect(() => {
    void fetchAccess()
  }, [fetchAccess])

  useEffect(() => {
    if (!user?.supabaseId) return

    const refreshAccess = () => {
      void fetchAccess()
    }

    const handleFocus = () => {
      refreshAccess()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAccess()
      }
    }

    const intervalId = window.setInterval(refreshAccess, ACCESS_POLL_INTERVAL_MS)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchAccess, user?.supabaseId])

  const hasAccess = useCallback((slug: string) => slugs.includes(slug), [slugs])
  const isBeta = useCallback((slug: string) => betaSlugs.includes(slug), [betaSlugs])

  const value = useMemo<FeatureAccessContextValue>(
    () => ({
      slugs,
      betaSlugs,
      userRole,
      isLoading,
      hasAccess,
      isBeta,
      refresh: async () => {
        await fetchAccess(true)
      },
    }),
    [slugs, betaSlugs, userRole, isLoading, hasAccess, isBeta, fetchAccess]
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
