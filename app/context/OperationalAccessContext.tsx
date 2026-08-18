"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useUserContext } from "./UserContext"
import { useTeamContext } from "./TeamContext"
import { API_CLIENT_BASE } from "@/lib/route-map";

export interface OperationalAccessData {
  associadosQueue: boolean
  multiskillTransferOrigin: boolean
  multiskillExternalTransfer: boolean
}

const DEFAULT_ACCESS: OperationalAccessData = {
  associadosQueue: false,
  multiskillTransferOrigin: false,
  multiskillExternalTransfer: false,
}

interface OperationalAccessContextValue {
  access: OperationalAccessData
  isLoading: boolean
  refresh: (force?: boolean) => Promise<void>
}

const OperationalAccessContext = createContext<OperationalAccessContextValue | undefined>(
  undefined
)

export type OperationalAccessInitialData = OperationalAccessData & {
  profileId: string
  teamId: string | null
}

interface OperationalAccessProviderProps {
  children: ReactNode
  initialAccess?: OperationalAccessInitialData | null
}

export function OperationalAccessProvider({
  children,
  initialAccess = null,
}: OperationalAccessProviderProps) {
  const { user } = useUserContext()
  const { activeTeamId } = useTeamContext()
  const [access, setAccess] = useState<OperationalAccessData>(
    initialAccess
      ? {
          associadosQueue: initialAccess.associadosQueue,
          multiskillTransferOrigin: initialAccess.multiskillTransferOrigin,
          multiskillExternalTransfer: initialAccess.multiskillExternalTransfer ?? false,
        }
      : DEFAULT_ACCESS
  )
  const [isLoading, setIsLoading] = useState(!initialAccess)
  const fetchGenerationRef = useRef(0)
  const inFlightRef = useRef(false)
  const lastRequestKeyRef = useRef(
    initialAccess ? `${initialAccess.profileId}:${initialAccess.teamId ?? "no-team"}` : ""
  )

  const fetchAccess = useCallback(async (force = false) => {
    if (!user?.id || inFlightRef.current) return

    const requestKey = `${user.id}:${activeTeamId ?? "no-team"}`
    const requestKeyChanged = lastRequestKeyRef.current !== requestKey
    if (!force && !requestKeyChanged) return

    if (requestKeyChanged) {
      setAccess(DEFAULT_ACCESS)
    }
    inFlightRef.current = true
    setIsLoading(true)

    const generation = ++fetchGenerationRef.current
    try {
      const response = await fetch(`${API_CLIENT_BASE}/me/operational-access`, {
        cache: "no-store",
        headers: activeTeamId ? { "x-team-id": activeTeamId } : undefined,
      })
      const contentType = response.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json")) {
        console.error(
          "[OperationalAccessContext] Erro ao carregar acessos operacionais:",
          new Error(`Resposta não-JSON (${response.status})`)
        )
        return
      }
      const data = (await response.json()) as {
        isValid?: boolean
        result?: OperationalAccessData
      }
      if (generation !== fetchGenerationRef.current) return
      if (response.ok && data.isValid && data.result) {
        setAccess(data.result)
        lastRequestKeyRef.current = requestKey
      }
    } catch (error) {
      console.error("[OperationalAccessContext] Erro ao carregar acessos operacionais:", error)
    } finally {
      inFlightRef.current = false
      if (generation !== fetchGenerationRef.current) return
      setIsLoading(false)
    }
  }, [activeTeamId, user?.id])

  useEffect(() => {
    if (
      initialAccess &&
      initialAccess.profileId === user?.id &&
      initialAccess.teamId === (activeTeamId ?? null)
    ) {
      return
    }
    void fetchAccess()
  }, [activeTeamId, fetchAccess, initialAccess, user?.id])

  const refresh = useCallback((force = true) => fetchAccess(force), [fetchAccess])

  const value = useMemo(
    () => ({
      access,
      isLoading,
      refresh,
    }),
    [access, isLoading, refresh]
  )

  return (
    <OperationalAccessContext.Provider value={value}>{children}</OperationalAccessContext.Provider>
  )
}

export function useOperationalAccess() {
  const context = useContext(OperationalAccessContext)
  if (!context) {
    throw new Error("useOperationalAccess must be used within OperationalAccessProvider")
  }
  return context
}
