"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type { IBackofficeContractsService } from "../services/IBackofficeContractsService"
import type {
  BackofficeContractsContextValue,
  CreateContractInput,
  UpdateContractInput,
} from "./BackofficeContractsTypes"
import { useBackofficeContractsHook } from "./BackofficeContractsHook"

const BackofficeContractsContext = createContext<BackofficeContractsContextValue | undefined>(
  undefined
)

export function BackofficeContractsProvider({
  children,
  service,
}: {
  children: ReactNode
  service: IBackofficeContractsService
}) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const { state, setSaving, setError, refresh } = useBackofficeContractsHook(service)
  const { items, clientOptions, isLoading, isSaving, error } = state

  const refreshWithLog = useCallback(async () => {
    try {
      await refresh()
    } catch (err) {
      console.error("[BackofficeContractsContext][refresh]", err)
      setError("Erro ao carregar contratos")
    }
  }, [refresh, setError])

  useEffect(() => {
    void refreshWithLog()
  }, [refreshWithLog])

  const createContract = useCallback(
    async (input: CreateContractInput) => {
      setSaving(true)
      try {
        const result = await service.create(input)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const addVersion = useCallback(
    async (contractId: string, file: File) => {
      setSaving(true)
      try {
        const result = await service.addVersion(contractId, file)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const updateContract = useCallback(
    async (id: string, input: UpdateContractInput) => {
      setSaving(true)
      try {
        const result = await service.update(id, input)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const deleteContract = useCallback(
    async (id: string) => {
      setSaving(true)
      try {
        const result = await service.remove(id)
        if (result.isValid) await refreshWithLog()
        return result
      } finally {
        setSaving(false)
      }
    },
    [refreshWithLog, service, setSaving]
  )

  const getContractDetail = useCallback(
    async (id: string) => {
      return service.getById(id)
    },
    [service]
  )

  const generateShareLink = useCallback(
    async (versionId: string) => {
      const result = await service.generateShareLink(versionId)
      if (result.isValid) await refreshWithLog()
      return result
    },
    [refreshWithLog, service]
  )

  const revokeShareLink = useCallback(
    async (versionId: string) => {
      const result = await service.revokeShareLink(versionId)
      if (result.isValid) await refreshWithLog()
      return result
    },
    [refreshWithLog, service]
  )

  const value = useMemo(
    () => ({
      items,
      clientOptions,
      isLoading,
      isSaving,
      error,
      canManage,
      refresh: refreshWithLog,
      createContract,
      addVersion,
      updateContract,
      deleteContract,
      getContractDetail,
      generateShareLink,
      revokeShareLink,
    }),
    [
      addVersion,
      canManage,
      clientOptions,
      createContract,
      deleteContract,
      error,
      generateShareLink,
      getContractDetail,
      isLoading,
      isSaving,
      items,
      refreshWithLog,
      revokeShareLink,
      updateContract,
    ]
  )

  return (
    <BackofficeContractsContext.Provider value={value}>
      {children}
    </BackofficeContractsContext.Provider>
  )
}

export function useBackofficeContracts() {
  const context = useContext(BackofficeContractsContext)
  if (!context) {
    throw new Error("useBackofficeContracts must be used within BackofficeContractsProvider")
  }
  return context
}
