"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { CepService } from "@/lib/services/CepService"
import type { PaymentFieldErrors, PaymentFieldName } from "./publicCheckoutPhases"
import type { PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"

const onlyDigits = (value: string, maxLength: number) => value.replace(/\D/g, "").slice(0, maxLength)

/**
 * Dados do pagador da fase Pagamento. O formulário é preenchido uma vez, quando os detalhes
 * chegam; depois disso a atualização de `prefill` (ex.: status que se reconsulta) não apaga o que
 * a pessoa digitou. O CEP preenche o endereço sozinho.
 */
export function usePublicCheckoutPayer({ prefill, ready }: { prefill: PublicCheckoutPayerPrefill; ready: boolean }) {
  const [form, setForm] = useState(prefill)
  const [fieldErrors, setFieldErrors] = useState<PaymentFieldErrors>({})
  const [cepResolved, setCepResolved] = useState(false)
  const [lastResolvedCep, setLastResolvedCep] = useState<string | null>(null)
  const preparedRef = useRef(false)

  useEffect(() => {
    if (!ready || preparedRef.current) return
    preparedRef.current = true
    setForm(prefill)
  }, [ready, prefill])

  const setField = useCallback((key: keyof PublicCheckoutPayerPrefill, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key as PaymentFieldName]: undefined }))
  }, [])

  const resolveCep = useCallback(
    async (cep: string) => {
      const data = await CepService.consultarCep(cep)
      if (!data) {
        setCepResolved(false)
        toast.error("CEP inválido ou não encontrado.")
        return
      }
      const formatted = CepService.formatarParaFormulario(data)
      setForm((prev) => ({
        ...prev,
        postalCode: cep,
        address: formatted.address,
        neighborhood: formatted.neighborhood,
        city: formatted.city,
        state: formatted.state,
        complement: formatted.complement || prev.complement,
      }))
      setCepResolved(true)
      setLastResolvedCep(cep)
    },
    [],
  )

  // Cobre a digitação e o CEP que já vem preenchido na prefill.
  useEffect(() => {
    const cep = onlyDigits(form.postalCode, 8)
    if (cep.length !== 8) {
      setCepResolved(false)
      return
    }
    if (lastResolvedCep === cep) return
    void resolveCep(cep)
  }, [form.postalCode, lastResolvedCep, resolveCep])

  return { form, setField, fieldErrors, setFieldErrors, cepResolved }
}
