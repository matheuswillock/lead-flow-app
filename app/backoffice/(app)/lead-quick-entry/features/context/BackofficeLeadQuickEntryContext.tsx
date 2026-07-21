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
import type { IBackofficeLeadQuickEntryService } from "../services/IBackofficeLeadQuickEntryService"
import type {
  BackofficeLeadQuickEntryFormData,
  BackofficeOptInCampaignInfo,
} from "./BackofficeLeadQuickEntryTypes"

export interface BackofficeLeadQuickEntryContextValue {
  optInCampaign: BackofficeOptInCampaignInfo | null
  isLoadingCampaign: boolean
  isSubmitting: boolean
  submit: (data: BackofficeLeadQuickEntryFormData) => Promise<boolean>
}

export const BackofficeLeadQuickEntryContext = createContext<
  BackofficeLeadQuickEntryContextValue | undefined
>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeLeadQuickEntryService
}

export function BackofficeLeadQuickEntryProvider({ children, service }: ProviderProps) {
  const [optInCampaign, setOptInCampaign] = useState<BackofficeOptInCampaignInfo | null>(null)
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    service
      .getOptInCampaign()
      .then(setOptInCampaign)
      .catch((err) => {
        console.error("[BackofficeLeadQuickEntryContext][getOptInCampaign]", err)
      })
      .finally(() => setIsLoadingCampaign(false))
  }, [service])

  const submit = useCallback(
    async (data: BackofficeLeadQuickEntryFormData) => {
      setIsSubmitting(true)
      try {
        await service.submit(data)
        toast.success("Lead cadastrado com sucesso")
        return true
      } catch (err) {
        console.error("[BackofficeLeadQuickEntryContext][submit]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao cadastrar lead")
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [service]
  )

  const value = useMemo<BackofficeLeadQuickEntryContextValue>(
    () => ({ optInCampaign, isLoadingCampaign, isSubmitting, submit }),
    [optInCampaign, isLoadingCampaign, isSubmitting, submit]
  )

  return (
    <BackofficeLeadQuickEntryContext.Provider value={value}>
      {children}
    </BackofficeLeadQuickEntryContext.Provider>
  )
}
