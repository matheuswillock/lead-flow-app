"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { backofficePublicLeadFormService } from "../services/BackofficePublicLeadFormService"
import type { SubmitBackofficePublicLeadPayload } from "../services/IBackofficePublicLeadFormService"
import type { IBackofficePublicLeadFormContext } from "./BackofficePublicLeadFormTypes"

export function useBackofficePublicLeadForm(): IBackofficePublicLeadFormContext {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [scheduledMeetingDate, setScheduledMeetingDate] = useState<string | null>(null)

  const submitLead = useCallback(
    async (payload: SubmitBackofficePublicLeadPayload) => {
      if (isSubmitting) return false

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const result = await backofficePublicLeadFormService.submitLead(payload)
        setIsSubmitted(true)
        setScheduledMeetingDate(result.meetingDate ?? null)
        toast.success(
          result.scheduled
            ? "Cadastro e agendamento enviados com sucesso"
            : "Cadastro enviado com sucesso"
        )
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
    setScheduledMeetingDate(null)
  }, [])

  return {
    isSubmitting,
    isSubmitted,
    submitError,
    scheduledMeetingDate,
    submitLead,
    resetForm,
  }
}
