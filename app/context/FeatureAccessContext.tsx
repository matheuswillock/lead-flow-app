"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useUserContext } from "./UserContext"
import { useTeamContext } from "./TeamContext"
import { API_CLIENT_BASE } from "@/lib/route-map";

export interface UserRoleData {
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
// Acesso a features muda raramente (mutações no backoffice) — TTL longo e sem
// polling por intervalo. O refresh acontece em focus/visibility (dedupado pelo
// TTL) e via refresh() manual após mutações.
const ACCESS_CACHE_TTL_MS = 10 * 60_000
// Após 401 (sessão ausente no proxy), evita storm em focus/visibility/effect.
const AUTH_FAIL_COOLDOWN_MS = 60_000

interface FeatureAccessContextValue {
  slugs: string[]
  betaSlugs: string[]
  betaLabelSlugs: string[]
  userRole: UserRoleData
  isLoading: boolean
  hasAccess: (slug: string) => boolean
  isBeta: (slug: string) => boolean
  showsBetaLabel: (slug: string) => boolean
  refresh: () => Promise<void>
}

const FeatureAccessContext = createContext<FeatureAccessContextValue | undefined>(undefined)

export interface FeatureAccessInitialData {
  slugs: string[]
  betaSlugs: string[]
  betaLabelSlugs: string[]
  userRole: UserRoleData | null
  /** Chave da resolução server-side, para invalidar se o time ativo divergir. */
  profileId: string
  teamId: string | null
}

interface FeatureAccessProviderProps {
  children: ReactNode
  /** Dados resolvidos no servidor (layout) — evita o fetch inicial no cliente. */
  initialAccess?: FeatureAccessInitialData | null
}

export function FeatureAccessProvider({ children, initialAccess = null }: FeatureAccessProviderProps) {
  const { user } = useUserContext()
  const { activeTeamId } = useTeamContext()
  const [slugs, setSlugs] = useState<string[]>(initialAccess?.slugs ?? [])
  const [betaSlugs, setBetaSlugs] = useState<string[]>(initialAccess?.betaSlugs ?? [])
  const [betaLabelSlugs, setBetaLabelSlugs] = useState<string[]>(initialAccess?.betaLabelSlugs ?? [])
  const [userRole, setUserRole] = useState<UserRoleData>(initialAccess?.userRole ?? DEFAULT_USER_ROLE)
  const [isLoading, setIsLoading] = useState(!initialAccess)
  const lastRequestKeyRef = useRef<string>(
    initialAccess ? `${initialAccess.profileId}:${initialAccess.teamId ?? "no-team"}` : ""
  )
  const lastFetchedAtRef = useRef<number>(initialAccess ? Date.now() : 0)
  const hasResolvedAccessRef = useRef(!!initialAccess)
  const inFlightRef = useRef(false)
  const authBlockedUntilRef = useRef(0)

  const matchesInitialAccess = useCallback(() => {
    if (!initialAccess || !user?.id) return false
    return (
      initialAccess.profileId === user.id &&
      initialAccess.teamId === (activeTeamId ?? null)
    )
  }, [activeTeamId, initialAccess, user?.id])

  const fetchAccess = useCallback(
    async (force = false) => {
      if (!user?.supabaseId || !user.id) {
        // Não apaga bootstrap SSR se o user ainda não hidratou — evita refetch em cascata.
        if (hasResolvedAccessRef.current || matchesInitialAccess()) {
          setIsLoading(false)
          return
        }
        setSlugs([])
        setBetaSlugs([])
        setBetaLabelSlugs([])
        setUserRole(DEFAULT_USER_ROLE)
        lastRequestKeyRef.current = ""
        lastFetchedAtRef.current = 0
        hasResolvedAccessRef.current = false
        setIsLoading(false)
        return
      }

      if (!force && Date.now() < authBlockedUntilRef.current) {
        return
      }

      const requestKey = `${user.id}:${activeTeamId ?? "no-team"}`
      const isSameRequest = lastRequestKeyRef.current === requestKey
      const isFresh = Date.now() - lastFetchedAtRef.current < ACCESS_CACHE_TTL_MS
      if (!force && isSameRequest && isFresh) {
        return
      }

      // Bootstrap do layout já resolveu o mesmo escopo — não refaz no mount.
      if (!force && matchesInitialAccess() && isSameRequest && isFresh) {
        return
      }

      if (inFlightRef.current) return
      inFlightRef.current = true
      if (!hasResolvedAccessRef.current) {
        setIsLoading(true)
      }

      try {
        const response = await fetch(`${API_CLIENT_BASE}/features/access`, {
          headers: activeTeamId ? { "x-team-id": activeTeamId } : undefined,
          cache: "no-store",
        })
        const output = await response.json()

        if (response.status === 401) {
          // Cooldown: focus/visibility/effect não devem martelar 401.
          authBlockedUntilRef.current = Date.now() + AUTH_FAIL_COOLDOWN_MS
          lastRequestKeyRef.current = requestKey
          lastFetchedAtRef.current = Date.now()
          // Mantém SSR/último resultado válido em vez de zerar a sidebar.
          return
        }

        if (!response.ok || !output.isValid) {
          // Falha não-auth: marca fetch para não loopar no mesmo tick de focus.
          lastRequestKeyRef.current = requestKey
          lastFetchedAtRef.current = Date.now()
          if (!hasResolvedAccessRef.current) {
            setSlugs([])
            setBetaSlugs([])
            setBetaLabelSlugs([])
            setUserRole(DEFAULT_USER_ROLE)
          }
          return
        }

        authBlockedUntilRef.current = 0
        lastRequestKeyRef.current = requestKey
        lastFetchedAtRef.current = Date.now()
        setSlugs(Array.isArray(output.result?.slugs) ? output.result.slugs : [])
        setBetaSlugs(Array.isArray(output.result?.betaSlugs) ? output.result.betaSlugs : [])
        setBetaLabelSlugs(Array.isArray(output.result?.betaLabelSlugs) ? output.result.betaLabelSlugs : [])
        const rawRole = output.result?.userRole
        setUserRole(rawRole && typeof rawRole === "object" ? (rawRole as UserRoleData) : DEFAULT_USER_ROLE)
      } catch (error) {
        console.error("[FeatureAccessContext] Erro ao carregar acesso:", error)
        lastRequestKeyRef.current = requestKey
        lastFetchedAtRef.current = Date.now()
        if (!hasResolvedAccessRef.current) {
          setSlugs([])
          setBetaSlugs([])
          setBetaLabelSlugs([])
          setUserRole(DEFAULT_USER_ROLE)
        }
      } finally {
        hasResolvedAccessRef.current = true
        setIsLoading(false)
        inFlightRef.current = false
      }
    },
    [activeTeamId, matchesInitialAccess, user?.id, user?.supabaseId]
  )

  useEffect(() => {
    if (matchesInitialAccess() && hasResolvedAccessRef.current) {
      return
    }
    void fetchAccess()
  }, [fetchAccess, matchesInitialAccess])

  useEffect(() => {
    if (!user?.supabaseId) return

    // Handler único para focus e visibilitychange — o guard de TTL/in-flight do
    // fetchAccess deduplica quando os dois eventos disparam juntos.
    const refreshAccess = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() < authBlockedUntilRef.current) return
      void fetchAccess()
    }

    window.addEventListener("focus", refreshAccess)
    document.addEventListener("visibilitychange", refreshAccess)

    return () => {
      window.removeEventListener("focus", refreshAccess)
      document.removeEventListener("visibilitychange", refreshAccess)
    }
  }, [fetchAccess, user?.supabaseId])

  const hasAccess = useCallback((slug: string) => slugs.includes(slug), [slugs])
  const isBeta = useCallback((slug: string) => betaSlugs.includes(slug), [betaSlugs])
  const showsBetaLabel = useCallback((slug: string) => betaLabelSlugs.includes(slug), [betaLabelSlugs])

  const value = useMemo<FeatureAccessContextValue>(
    () => ({
      slugs,
      betaSlugs,
      betaLabelSlugs,
      userRole,
      isLoading,
      hasAccess,
      isBeta,
      showsBetaLabel,
      refresh: async () => {
        authBlockedUntilRef.current = 0
        await fetchAccess(true)
      },
    }),
    [slugs, betaSlugs, betaLabelSlugs, userRole, isLoading, hasAccess, isBeta, showsBetaLabel, fetchAccess]
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

/** Safe outside FeatureAccessProvider (e.g. backoffice-hosted product email UI). */
export function useOptionalFeatureAccess(): FeatureAccessContextValue | null {
  return useContext(FeatureAccessContext) ?? null
}
