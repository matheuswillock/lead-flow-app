"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import type { IBackofficePaymentProvidersService } from "../services/IBackofficePaymentProvidersService"
import { findCurrentDefault, replaceInstance } from "../utils/providerInstanceRules"
import {
  PaymentProvidersApiError,
  type CreateProviderInstanceInput,
  type PaymentProviderEnvironment,
  type ProviderAdapterView,
  type ProviderHistoryItem,
  type ProviderInstanceView,
  type UpdateProviderInstanceInput,
} from "./BackofficePaymentProvidersTypes"

type InstancePatch = Omit<UpdateProviderInstanceInput, "id" | "expectedRevision">

interface PaymentProvidersContextValue {
  environment: PaymentProviderEnvironment
  setEnvironment: (environment: PaymentProviderEnvironment) => void
  instances: ProviderInstanceView[]
  adapters: ProviderAdapterView[]
  isLoading: boolean
  canManage: boolean
  /** Padrão atual do ambiente selecionado. */
  currentDefault: ProviderInstanceView | null

  selectedInstance: ProviderInstanceView | null
  selectInstance: (id: string | null) => void

  /** Id da instância com mutação em andamento (trava o primeiro clique). */
  busyInstanceId: string | null
  isCreating: boolean
  createInstance: (input: CreateProviderInstanceInput) => Promise<boolean>
  updateInstance: (instance: ProviderInstanceView, patch: InstancePatch, successMessage: string) => Promise<boolean>
  setCredential: (instance: ProviderInstanceView, key: string, value: string) => Promise<boolean>
  removeCredential: (instance: ProviderInstanceView, key: string) => Promise<boolean>
  runHealthCheck: (instance: ProviderInstanceView) => Promise<void>

  history: ProviderHistoryItem[]
  isHistoryLoading: boolean
  loadHistory: (configId: string) => Promise<void>
}

const CONFLICT_MESSAGE =
  "Esta instância foi alterada por outra pessoa. Recarregamos os dados atuais; revise e tente de novo."

const PaymentProvidersContext = createContext<PaymentProvidersContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  service: IBackofficePaymentProvidersService
}

export function BackofficePaymentProvidersProvider({ children, service }: Props) {
  const { user } = useBackofficeUser()
  // Falha fechada: sem usuário carregado, a escrita fica desabilitada.
  const canManage = user !== null && !user.isOperator

  const [environment, setEnvironment] = useState<PaymentProviderEnvironment>("PRODUCTION")
  const [instances, setInstances] = useState<ProviderInstanceView[]>([])
  const [adapters, setAdapters] = useState<ProviderAdapterView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyInstanceId, setBusyInstanceId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [history, setHistory] = useState<ProviderHistoryItem[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const busyRef = useRef(false)
  const adaptersRef = useRef<Promise<ProviderAdapterView[]> | null>(null)

  const reloadInstances = useCallback(
    async (target: PaymentProviderEnvironment) => {
      const items = await service.listInstances(target)
      setInstances(items)
      return items
    },
    [service]
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const adaptersRequest = adaptersRef.current ?? service.listAdapters()
    Promise.all([service.listInstances(environment), adaptersRequest])
      .then(([items, loadedAdapters]) => {
        if (cancelled) return
        adaptersRef.current = Promise.resolve(loadedAdapters)
        setInstances(items)
        setAdapters(loadedAdapters)
      })
      .catch((err) => {
        adaptersRef.current = null
        if (!cancelled) toast.error(toUserToastMessage(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [environment, service])

  const handleMutationError = useCallback(
    async (err: unknown) => {
      if (err instanceof PaymentProvidersApiError && err.isConflict) {
        toast.error(CONFLICT_MESSAGE)
        try {
          await reloadInstances(environment)
        } catch (reloadError) {
          toast.error(toUserToastMessage(reloadError))
        }
        return
      }
      toast.error(toUserToastMessage(err))
    },
    [environment, reloadInstances]
  )

  const runInstanceMutation = useCallback(
    async (instanceId: string, action: () => Promise<ProviderInstanceView>, successMessage?: string) => {
      if (busyRef.current) return false
      busyRef.current = true
      setBusyInstanceId(instanceId)
      try {
        const updated = await action()
        setInstances((prev) => replaceInstance(prev, updated))
        if (successMessage) toast.success(successMessage)
        return true
      } catch (err) {
        await handleMutationError(err)
        return false
      } finally {
        busyRef.current = false
        setBusyInstanceId(null)
      }
    },
    [handleMutationError]
  )

  const updateInstance = useCallback(
    (instance: ProviderInstanceView, patch: InstancePatch, successMessage: string) =>
      runInstanceMutation(
        instance.id,
        () => service.updateInstance({ ...patch, id: instance.id, expectedRevision: instance.configRevision }),
        successMessage
      ),
    [runInstanceMutation, service]
  )

  const setCredential = useCallback(
    (instance: ProviderInstanceView, key: string, value: string) => {
      if (value.length === 0) return Promise.resolve(false)
      return runInstanceMutation(instance.id, () => service.setCredential(instance.id, key, value), "Credencial salva")
    },
    [runInstanceMutation, service]
  )

  const removeCredential = useCallback(
    (instance: ProviderInstanceView, key: string) =>
      runInstanceMutation(instance.id, () => service.removeCredential(instance.id, key), "Credencial removida"),
    [runInstanceMutation, service]
  )

  const runHealthCheck = useCallback(
    async (instance: ProviderInstanceView) => {
      await runInstanceMutation(instance.id, () => service.runHealthCheck(instance.id), "Verificação concluída")
    },
    [runInstanceMutation, service]
  )

  const createInstance = useCallback(
    async (input: CreateProviderInstanceInput) => {
      if (isCreating) return false
      setIsCreating(true)
      try {
        const created = await service.createInstance(input)
        if (created.environment === environment) {
          setInstances((prev) => replaceInstance(prev, created))
        } else {
          setEnvironment(created.environment)
        }
        toast.success("Instância criada")
        return true
      } catch (err) {
        toast.error(toUserToastMessage(err))
        return false
      } finally {
        setIsCreating(false)
      }
    },
    [environment, isCreating, service]
  )

  const loadHistory = useCallback(
    async (configId: string) => {
      setIsHistoryLoading(true)
      try {
        setHistory(await service.listHistory(configId))
      } catch (err) {
        setHistory([])
        toast.error(toUserToastMessage(err))
      } finally {
        setIsHistoryLoading(false)
      }
    },
    [service]
  )

  const selectedInstance = useMemo(
    () => instances.find((item) => item.id === selectedId) ?? null,
    [instances, selectedId]
  )
  const currentDefault = useMemo(() => findCurrentDefault(instances), [instances])

  const value: PaymentProvidersContextValue = {
    environment,
    setEnvironment,
    instances,
    adapters,
    isLoading,
    canManage,
    currentDefault,
    selectedInstance,
    selectInstance: setSelectedId,
    busyInstanceId,
    isCreating,
    createInstance,
    updateInstance,
    setCredential,
    removeCredential,
    runHealthCheck,
    history,
    isHistoryLoading,
    loadHistory,
  }

  return <PaymentProvidersContext.Provider value={value}>{children}</PaymentProvidersContext.Provider>
}

export function useBackofficePaymentProviders(): PaymentProvidersContextValue {
  const ctx = useContext(PaymentProvidersContext)
  if (!ctx) throw new Error("useBackofficePaymentProviders must be used within BackofficePaymentProvidersProvider")
  return ctx
}
