"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

export interface BackofficeUserData {
  profileId: string
  email: string
  fullName: string | null
  fullAccess: boolean
}

interface BackofficeUserContextState {
  user: BackofficeUserData | null
  isLoading: boolean
  error: string | null
}

const BackofficeUserContext = createContext<BackofficeUserContextState | undefined>(undefined)

export function BackofficeUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackofficeUserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (inFlight.current) return
    inFlight.current = true

    fetch("/api/v1/backoffice/me")
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

  return (
    <BackofficeUserContext.Provider value={{ user, isLoading, error }}>
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
