"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type { IBackofficeFormTemplatesService } from "../services/IBackofficeFormTemplatesService"
import type { BackofficeFormTemplatesContextValue } from "./BackofficeFormTemplatesTypes"
import { useBackofficeFormTemplatesHook } from "./BackofficeFormTemplatesHook"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

const BackofficeFormTemplatesContext = createContext<BackofficeFormTemplatesContextValue | undefined>(
  undefined,
)

export function BackofficeFormTemplatesProvider({
  children,
  service,
}: {
  children: ReactNode
  service: IBackofficeFormTemplatesService
}) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const { state, setSaving, setError, refresh } = useBackofficeFormTemplatesHook(service)
  const { items, isLoading, isSaving, error } = state

  const refreshWithLog = useCallback(async () => {
    try {
      await refresh()
    } catch (err) {
      console.error("[BackofficeFormTemplatesContext][refresh]", err)
      setError("Erro ao carregar templates de formulário")
    }
  }, [refresh, setError])

  useEffect(() => {
    void refreshWithLog()
  }, [refreshWithLog])

  const publishItem = useCallback(
    async (id: string) => {
      setSaving(true)
      try {
        await service.publish(id)
        await refreshWithLog()
        return { isValid: true }
      } catch (err) {
        return {
          isValid: false,
          errorMessages: [toUserToastMessage(err)],
        }
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving],
  )

  const unpublishItem = useCallback(
    async (id: string) => {
      setSaving(true)
      try {
        await service.unpublish(id)
        await refreshWithLog()
        return { isValid: true }
      } catch (err) {
        return {
          isValid: false,
          errorMessages: [toUserToastMessage(err)],
        }
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving],
  )

  const value = useMemo<BackofficeFormTemplatesContextValue>(
    () => ({
      items,
      isLoading,
      isSaving,
      error,
      canManage,
      refresh: refreshWithLog,
      publishItem,
      unpublishItem,
    }),
    [canManage, error, isLoading, isSaving, items, publishItem, refreshWithLog, unpublishItem],
  )

  return (
    <BackofficeFormTemplatesContext.Provider value={value}>
      {children}
    </BackofficeFormTemplatesContext.Provider>
  )
}

export function useBackofficeFormTemplates() {
  const context = useContext(BackofficeFormTemplatesContext)
  if (!context) {
    throw new Error("useBackofficeFormTemplates must be used within BackofficeFormTemplatesProvider")
  }
  return context
}
