"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type { IBackofficeAccountService } from "../services/IBackofficeAccountService"
import type {
  BackofficeAccountData,
  BackofficeAccountUpdateInput,
  BackofficeGoogleScopesResult,
} from "./BackofficeAccountTypes"

interface BackofficeAccountContextValue {
  account: BackofficeAccountData | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateAccount: (input: BackofficeAccountUpdateInput) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  uploadIcon: (file: File) => Promise<void>
  removeIcon: () => Promise<void>
  updateTimezone: (timezone: string) => Promise<void>
  getGoogleScopes: () => Promise<BackofficeGoogleScopesResult>
  disconnectGoogle: () => Promise<void>
}

export const BackofficeAccountContext = createContext<
  BackofficeAccountContextValue | undefined
>(
  undefined
)

export function BackofficeAccountProvider({
  children,
  service,
}: {
  children: ReactNode
  service: IBackofficeAccountService
}) {
  const { refreshUser } = useBackofficeUser()
  const [account, setAccount] = useState<BackofficeAccountData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current

    const request = (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await service.getAccount()
        setAccount(data)
      } catch (err) {
        console.error("[BackofficeAccountContext][refresh]", err)
        setError(toUserToastMessage(err))
      } finally {
        setIsLoading(false)
        inFlightRef.current = null
      }
    })()

    inFlightRef.current = request
    return request
  }, [service])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const updateAccount = useCallback(
    async (input: BackofficeAccountUpdateInput) => {
      const updated = await service.updateAccount(input)
      setAccount(updated)
      await refreshUser()
      toast.success("Conta atualizada")
    },
    [refreshUser, service]
  )

  const updatePassword = useCallback(
    async (password: string) => {
      await service.updatePassword(password)
      toast.success("Senha atualizada")
    },
    [service]
  )

  const uploadIcon = useCallback(
    async (file: File) => {
      const uploaded = await service.uploadIcon(file)
      setAccount((prev) =>
        prev
          ? { ...prev, profileIconId: uploaded.iconId, profileIconUrl: uploaded.publicUrl }
          : prev
      )
      await refreshUser()
      toast.success("Ícone atualizado")
    },
    [refreshUser, service]
  )

  const removeIcon = useCallback(async () => {
    await service.removeIcon()
    setAccount((prev) =>
      prev ? { ...prev, profileIconId: null, profileIconUrl: null } : prev
    )
    await refreshUser()
    toast.success("Ícone removido")
  }, [refreshUser, service])

  const updateTimezone = useCallback(
    async (timezone: string) => {
      const updatedTimezone = await service.updateTimezone(timezone)
      setAccount((prev) => (prev ? { ...prev, timezone: updatedTimezone } : prev))
      await refreshUser()
      toast.success("Fuso horário atualizado")
    },
    [refreshUser, service]
  )

  const getGoogleScopes = useCallback(async () => {
    return service.getGoogleScopes()
  }, [service])

  const disconnectGoogle = useCallback(async () => {
    await service.disconnectGoogle()
    setAccount((prev) =>
      prev
        ? {
            ...prev,
            googleCalendarConnected: false,
            googleEmail: null,
            googleConnectionSource: null,
          }
        : prev
    )
    await refreshUser()
    toast.success("Google Calendar desconectado")
  }, [refreshUser, service])

  const value = useMemo<BackofficeAccountContextValue>(
    () => ({
      account,
      isLoading,
      error,
      refresh,
      updateAccount,
      updatePassword,
      uploadIcon,
      removeIcon,
      updateTimezone,
      getGoogleScopes,
      disconnectGoogle,
    }),
    [
      account,
      isLoading,
      error,
      refresh,
      updateAccount,
      updatePassword,
      uploadIcon,
      removeIcon,
      updateTimezone,
      getGoogleScopes,
      disconnectGoogle,
    ]
  )

  return (
    <BackofficeAccountContext.Provider value={value}>
      {children}
    </BackofficeAccountContext.Provider>
  )
}
