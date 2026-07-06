"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useParams } from "next/navigation"
import {
  confirmEmailUnsubscribe,
  createInitialEmailUnsubscribeState,
  defaultEmailUnsubscribeService,
  loadEmailUnsubscribeInfo,
} from "./EmailUnsubscribeHook"
import type { EmailUnsubscribeState } from "./EmailUnsubscribeTypes"
import type { IEmailUnsubscribeService } from "../services/IEmailUnsubscribeService"

type EmailUnsubscribeContextValue = EmailUnsubscribeState & {
  handleConfirm: () => Promise<void>
}

const EmailUnsubscribeContext = createContext<EmailUnsubscribeContextValue | null>(null)

export function EmailUnsubscribeProvider({
  children,
  service = defaultEmailUnsubscribeService,
}: {
  children: ReactNode
  service?: IEmailUnsubscribeService
}) {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [state, setState] = useState<EmailUnsubscribeState>(() => createInitialEmailUnsubscribeState(token))
  const loadedTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!token || loadedTokenRef.current === token) return
    loadedTokenRef.current = token

    void (async () => {
      setState((current) => ({ ...current, token, loading: true, error: null }))
      const result = await loadEmailUnsubscribeInfo(service, token)
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
      const result = await confirmEmailUnsubscribe(service, token)
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

  return <EmailUnsubscribeContext.Provider value={value}>{children}</EmailUnsubscribeContext.Provider>
}

export function useEmailUnsubscribeContext() {
  const context = useContext(EmailUnsubscribeContext)
  if (!context) {
    throw new Error("useEmailUnsubscribeContext deve ser usado dentro de EmailUnsubscribeProvider")
  }
  return context
}
