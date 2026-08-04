"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useParams } from "next/navigation"
import {
  confirmEmailUnsubscribe,
  createInitialEmailUnsubscribeState,
  defaultEmailUnsubscribeService,
  loadEmailUnsubscribeInfo,
} from "./EmailUnsubscribeHook"
import type { EmailUnsubscribeScope, EmailUnsubscribeState } from "./EmailUnsubscribeTypes"
import type { IEmailUnsubscribeService } from "../services/IEmailUnsubscribeService"

type EmailUnsubscribeContextValue = EmailUnsubscribeState & {
  setRemoveFromCampaign: (checked: boolean) => void
  setRemoveFromAll: (checked: boolean) => void
  handleConfirm: () => Promise<void>
}

const EmailUnsubscribeContext = createContext<EmailUnsubscribeContextValue | null>(null)

function resolveScope(removeFromCampaign: boolean, removeFromAll: boolean): EmailUnsubscribeScope | null {
  if (removeFromAll) return "all"
  if (removeFromCampaign) return "campaign"
  return null
}

export function EmailUnsubscribeProvider({
  children,
  service = defaultEmailUnsubscribeService,
  token: tokenProp,
  initialInfo,
}: {
  children: ReactNode
  service?: IEmailUnsubscribeService
  /** Token passado pelo Server Component (evita useParams no provider). */
  token?: string
  /** Info pré-carregada pelo Server Component — evita requisição visível no Network. */
  initialInfo?: EmailUnsubscribeState["info"] | null
}) {
  const params = useParams<{ token: string }>()
  const token = tokenProp ?? params.token

  const [state, setState] = useState<EmailUnsubscribeState>(() => {
    const base = createInitialEmailUnsubscribeState(token)
    if (initialInfo !== undefined) {
      // initialInfo === null significa que o Server Component tentou carregar
      // e o token era inválido/expirado — exibir erro imediatamente.
      if (initialInfo === null) {
        return { ...base, loading: false, info: null, error: "Link inválido ou expirado" }
      }
      const completed = !!(initialInfo.alreadyUnsubscribed || initialInfo.alreadyBlocked)
      return { ...base, loading: false, info: initialInfo, completed }
    }
    return base
  })
  const loadedTokenRef = useRef<string | null>(initialInfo !== undefined ? token : null)

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

  const setRemoveFromCampaign = useCallback((checked: boolean) => {
    setState((current) => ({ ...current, removeFromCampaign: checked }))
  }, [])

  const setRemoveFromAll = useCallback((checked: boolean) => {
    setState((current) => ({
      ...current,
      removeFromAll: checked,
      ...(checked ? { removeFromCampaign: true } : {}),
    }))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (state.confirming || state.completed) return
    const scope = resolveScope(state.removeFromCampaign, state.removeFromAll)
    if (!scope) {
      setState((current) => ({
        ...current,
        error: "Selecione ao menos uma preferência",
      }))
      return
    }

    setState((current) => ({ ...current, confirming: true, error: null }))
    try {
      const result = await confirmEmailUnsubscribe(service, token, scope)
      setState((current) => ({
        ...current,
        confirming: false,
        completed: result.completed,
        error: result.error,
      }))
    } finally {
      setState((current) => ({ ...current, confirming: false }))
    }
  }, [
    service,
    state.completed,
    state.confirming,
    state.removeFromAll,
    state.removeFromCampaign,
    token,
  ])

  const value = useMemo(
    () => ({
      ...state,
      setRemoveFromCampaign,
      setRemoveFromAll,
      handleConfirm,
    }),
    [handleConfirm, setRemoveFromAll, setRemoveFromCampaign, state]
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
