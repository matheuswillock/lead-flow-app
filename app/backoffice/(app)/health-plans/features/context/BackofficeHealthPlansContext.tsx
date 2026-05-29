"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import type {
  BackofficeHealthPlanPayload,
  BackofficeHealthPlanUpdatePayload,
  IBackofficeHealthPlansService,
} from "../services/IBackofficeHealthPlansService"
import type { BackofficeHealthPlansContextValue } from "./BackofficeHealthPlansTypes"
import { useBackofficeHealthPlansHook } from "./BackofficeHealthPlansHook"

const BackofficeHealthPlansContext = createContext<BackofficeHealthPlansContextValue | undefined>(undefined)

export function BackofficeHealthPlansProvider({
  children,
  service,
}: {
  children: ReactNode
  service: IBackofficeHealthPlansService
}) {
  const { state, setSaving, setError, refresh } = useBackofficeHealthPlansHook(service)
  const { items, isLoading, isSaving, error } = state

  const refreshWithLog = useCallback(async () => {
    try {
      await refresh()
    } catch (err) {
      console.error("[BackofficeHealthPlansContext][refresh]", err)
      setError("Erro ao carregar operadoras")
    }
  }, [refresh, setError])

  useEffect(() => {
    void refreshWithLog()
  }, [refreshWithLog])

  const createItem = useCallback(
    async (payload: BackofficeHealthPlanPayload) => {
      setSaving(true)
      try {
        const result = await service.create(payload)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const updateItem = useCallback(
    async (id: string, payload: BackofficeHealthPlanUpdatePayload) => {
      setSaving(true)
      try {
        const result = await service.update(id, payload)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const deactivateItem = useCallback(
    async (id: string) => {
      setSaving(true)
      try {
        const result = await service.deactivate(id)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const uploadIcon = useCallback(
    async (file: File) => {
      return service.uploadIcon(file)
    },
    [service]
  )

  const value = useMemo(
    () => ({
      items,
      isLoading,
      isSaving,
      error,
      refresh: refreshWithLog,
      createItem,
      updateItem,
      deactivateItem,
      uploadIcon,
    }),
    [createItem, deactivateItem, error, isLoading, isSaving, items, refreshWithLog, updateItem, uploadIcon]
  )

  return <BackofficeHealthPlansContext.Provider value={value}>{children}</BackofficeHealthPlansContext.Provider>
}

export function useBackofficeHealthPlans() {
  const context = useContext(BackofficeHealthPlansContext)
  if (!context) {
    throw new Error("useBackofficeHealthPlans must be used within BackofficeHealthPlansProvider")
  }
  return context
}
