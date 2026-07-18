"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useParams } from "next/navigation"
import {
  confirmBackofficeEmailUnsubscribe,
  createInitialBackofficeEmailUnsubscribeState,
  defaultBackofficeEmailUnsubscribeService,
  loadBackofficeEmailUnsubscribeInfo,
} from "./BackofficeEmailUnsubscribeHook"
import type { BackofficeEmailUnsubscribeState } from "./BackofficeEmailUnsubscribeTypes"
import type { IBackofficeEmailUnsubscribeService } from "../services/IBackofficeEmailUnsubscribeService"

type BackofficeEmailUnsubscribeContextValue = BackofficeEmailUnsubscribeState & {
  handleConfirm: () => Promise<void>
}

const BackofficeEmailUnsubscribeContext = createContext<BackofficeEmailUnsubscribeContextValue | null>(
  null
)

export function BackofficeEmailUnsubscribeProvider({
  children,
  service = defaultBackofficeEmailUnsubscribeService,
}: {
  children: ReactNode
  service?: IBackofficeEmailUnsubscribeService
}) {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [state, setState] = useState<BackofficeEmailUnsubscribeState>(() =>
    createInitialBackofficeEmailUnsubscribeState(token)
  )
  const loadedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!token || loadedTokenRef.current === token) return
    loadedTokenRef.current = token

    void (async () => {
      setState((current) => ({ ...current, token, loading: true, error: null }))
      const result = await loadBackofficeEmailUnsubscribeInfo(service, token)
      setState((current) => ({
        ...current,
        loading: false,
        info: result.info,
        error: result.error,
        completed: result.completed,
      }))
    })()
  }, [service, token])

  const handleConfirm = useCallback(async () => {
    if (state.confirming || state.completed) return
    setState((current) => ({ ...current, confirming: true, error: null }))
    try {
      const result = await confirmBackofficeEmailUnsubscribe(service, token)
      setState((current) => ({
        ...current,
        confirming: false,
        completed: result.completed,
        error: result.error,
      }))
    } finally {
      setState((current) => ({ ...current, confirming: false }))
    }
  }, [service, state.completed, state.confirming, token])

  const value = useMemo(
    () => ({
      ...state,
      handleConfirm,
    }),
    [handleConfirm, state]
  )

  return (
    <BackofficeEmailUnsubscribeContext.Provider value={value}>
      {children}
    </BackofficeEmailUnsubscribeContext.Provider>
  )
}

export function useBackofficeEmailUnsubscribeContext() {
  const context = useContext(BackofficeEmailUnsubscribeContext)
  if (!context) {
    throw new Error(
      "useBackofficeEmailUnsubscribeContext deve ser usado dentro de BackofficeEmailUnsubscribeProvider"
    )
  }
  return context
}
