"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { backofficePublicLeadFormService } from "../services/BackofficePublicLeadFormService"
import type { IBackofficePublicLeadFormContext } from "./BackofficePublicLeadFormTypes"

export function useBackofficePublicLeadForm(): IBackofficePublicLeadFormContext {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitLead = useCallback(
    async (payload: {
      name: string
      email?: string
      phone?: string
      cpfCnpj?: string
      notes?: string
      qualificationLeadOrganization?: string
      qualificationAvgUsers?: string
      qualificationProfileFit?: string
    }) => {
      if (isSubmitting) return false

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        await backofficePublicLeadFormService.submitLead(payload)
        setIsSubmitted(true)
        toast.success("Cadastro enviado com sucesso")
        return true
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro ao enviar o formulário."
        setSubmitError(message)
        toast.error(message)
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [isSubmitting],
  )

  const resetForm = useCallback(() => {
    setIsSubmitted(false)
    setSubmitError(null)
  }, [])

  return {
    isSubmitting,
    isSubmitted,
    submitError,
    submitLead,
    resetForm,
  }
}
