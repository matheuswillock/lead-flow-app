"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

export interface BackofficeUserData {
  profileId: string
  supabaseId: string | null
  backofficeUserId: string | null
  email: string
  fullName: string | null
  phone: string | null
  cpfCnpj: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  city: string | null
  state: string | null
  profileIconId: string | null
  profileIconUrl: string | null
  fullAccess: boolean
  isOperator: boolean
  isSdr: boolean
  isCloser: boolean
  googleCalendarConnected: boolean
  googleEmail: string | null
  timezone: string
}

interface BackofficeUserContextState {
  user: BackofficeUserData | null
  isLoading: boolean
  error: string | null
  refreshUser: () => Promise<void>
}

const BackofficeUserContext = createContext<BackofficeUserContextState | undefined>(undefined)

export function BackofficeUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackofficeUserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const refreshUser = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)

    await fetch("/api/v1/backoffice/current-user", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.isValid && data.result) {
          setUser(data.result)
        } else {
          setError(data.errorMessages?.[0] ?? "Erro ao carregar dados do usuário")
        }
      })
      .catch(() => setError("Erro ao carregar dados do usuário"))
      .finally(() => {
        setIsLoading(false)
        inFlight.current = false
      })
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  return (
    <BackofficeUserContext.Provider value={{ user, isLoading, error, refreshUser }}>
      {children}
    </BackofficeUserContext.Provider>
  )
}

export function useBackofficeUser(): BackofficeUserContextState {
  const context = useContext(BackofficeUserContext)
  if (!context) {
    throw new Error("useBackofficeUser must be used within BackofficeUserProvider")
  }
  return context
}
