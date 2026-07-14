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
  refresh: () => Promise<void>
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
  const inFlightRef = useRef(false)
  const lastRequestKeyRef = useRef(
    initialAccess ? `${initialAccess.profileId}:${initialAccess.teamId ?? "no-team"}` : ""
  )

  const fetchAccess = useCallback(async () => {
    if (!user?.id || inFlightRef.current) return

    const requestKey = `${user.id}:${activeTeamId ?? "no-team"}`
    if (requestKey === lastRequestKeyRef.current && !isLoading) return

    inFlightRef.current = true
    setIsLoading(true)
    try {
      const response = await fetch("/api/v1/me/operational-access", { cache: "no-store" })
      const data = await response.json()
      if (response.ok && data.isValid && data.result) {
        setAccess(data.result as OperationalAccessData)
        lastRequestKeyRef.current = requestKey
      }
    } catch (error) {
      console.error("[OperationalAccessContext] Erro ao carregar acessos operacionais:", error)
    } finally {
      inFlightRef.current = false
      setIsLoading(false)
    }
  }, [activeTeamId, isLoading, user?.id])

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

  const value = useMemo(
    () => ({
      access,
      isLoading,
      refresh: fetchAccess,
    }),
    [access, fetchAccess, isLoading]
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
