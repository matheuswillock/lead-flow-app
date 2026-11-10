"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { maskCEP, maskPhone } from "@/lib/masks"
import { CepService } from "@/lib/services/CepService"
import {
  firstInvalidAdhesionField,
  initialAdhesionPaymentValues,
  validateAdhesionPaymentForm,
  type AdhesionPaymentFieldErrors,
  type AdhesionPaymentFieldName,
  type AdhesionPaymentFormValues,
} from "../utils/adhesionPaymentForm"

type Prefill = { fullName: string; email: string; phone: string }

function applyMask(field: AdhesionPaymentFieldName, value: string): string {
  switch (field) {
    case "phone":
      return maskPhone(value)
    case "postalCode":
      return maskCEP(value)
    case "state":
      return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2)
    default:
      return value
  }
}

/**
 * Estado do formulário de pagamento: valores com máscara, erro só nos campos já visitados (ou após
 * tentar enviar) e preenchimento do endereço pelo CEP. A validação é a mesma do envio.
 */
export function useAdhesionPaymentForm(
  prefill: Prefill,
  options: { needsAddress: boolean; includePayer?: boolean },
) {
  const [values, setValues] = useState<AdhesionPaymentFormValues>(() => initialAdhesionPaymentValues(prefill))
  const [touched, setTouched] = useState<Partial<Record<AdhesionPaymentFieldName, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isResolvingCep, setIsResolvingCep] = useState(false)
  const lastCep = useRef<string | null>(null)

  const allErrors = useMemo<AdhesionPaymentFieldErrors>(
    () => validateAdhesionPaymentForm(values, options),
    [options, values],
  )

  const errors = useMemo<AdhesionPaymentFieldErrors>(() => {
    if (submitAttempted) return allErrors
    const visible: AdhesionPaymentFieldErrors = {}
    for (const key of Object.keys(allErrors) as AdhesionPaymentFieldName[]) {
      if (touched[key]) visible[key] = allErrors[key]
    }
    return visible
  }, [allErrors, submitAttempted, touched])

  const resolveCep = useCallback(async (maskedCep: string) => {
    const cep = maskedCep.replace(/\D/g, "")
    if (cep.length !== 8 || lastCep.current === cep) return
    lastCep.current = cep
    setIsResolvingCep(true)
    try {
      const data = await CepService.consultarCep(cep)
      if (!data) {
        lastCep.current = null
        toast.error("CEP inválido ou não encontrado.")
        return
      }
      const formatted = CepService.formatarParaFormulario(data)
      setValues((current) => ({
        ...current,
        address: formatted.address,
        neighborhood: formatted.neighborhood,
        city: formatted.city,
        state: formatted.state,
        complement: formatted.complement || current.complement,
      }))
    } finally {
      setIsResolvingCep(false)
    }
  }, [])

  const setField = useCallback(
    (field: AdhesionPaymentFieldName | "complement", value: string) => {
      const next = field === "complement" ? value : applyMask(field, value)
      setValues((current) => ({ ...current, [field]: next }))
      if (field === "postalCode") void resolveCep(next)
    },
    [resolveCep],
  )

  const setInstallments = useCallback((installments: number) => {
    setValues((current) => ({ ...current, installments }))
  }, [])

  const touch = useCallback((field: AdhesionPaymentFieldName) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }, [])

  /** Marca a tentativa de envio e devolve o primeiro campo inválido (ou `null` quando está tudo certo). */
  const validateForSubmit = useCallback((): AdhesionPaymentFieldName | null => {
    setSubmitAttempted(true)
    return firstInvalidAdhesionField(allErrors)
  }, [allErrors])

  return { values, errors, isResolvingCep, setField, setInstallments, touch, validateForSubmit }
}
