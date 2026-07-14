"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { IAcceptanceService } from "../services/IAcceptanceService"
import type { AcceptanceContextValue, AcceptanceForm, AcceptancePageData, AcceptanceResult } from "./AcceptanceTypes"

export function useAcceptanceHook(service: IAcceptanceService): AcceptanceContextValue {
  const [data, setData] = useState<AcceptancePageData | null>(null)
  const [result, setResult] = useState<AcceptanceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isLoading || data) return
    setIsLoading(true)
    setError(null)
    try { setData(await service.getData()) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o aceite") }
    finally { setIsLoading(false) }
  }, [data, isLoading, service])

  const submit = useCallback(async (form: AcceptanceForm) => {
    if (!data || isSubmitting) return
    setIsSubmitting(true)
    try { setResult(await service.submit(data, form)) }
    catch (submitError) {
      const errorWithStatus = submitError as Error & { status?: number }
      if (errorWithStatus.status === 409) {
        setData(null)
        setError(null)
        toast.error("Os documentos foram atualizados. Revise novamente as versões vigentes.")
        return
      }
      toast.error(errorWithStatus.message)
    } finally { setIsSubmitting(false) }
  }, [data, isSubmitting, service])

  return { data, result, isLoading, isSubmitting, error, load, submit }
}

