"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { isValidCNPJ, maskPhone } from "@/lib/masks"
import {
  SELF_CHECKOUT_COUPON_MAX_LENGTH,
  SELF_CHECKOUT_ERROR_CODES,
  SELF_CHECKOUT_EXTRAS_MAX,
  type SelfCheckoutBillingType,
  type SelfCheckoutCouponQuote,
  type SelfCheckoutCycle,
  type SelfCheckoutOptionsDTO,
} from "@/lib/self-checkout/contracts"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import type { ISelfCheckoutService } from "../services/ISelfCheckoutService"
import { SelfCheckoutService } from "../services/SelfCheckoutService"
import type {
  SelfCheckoutCouponStatus,
  SelfCheckoutFieldErrors,
  SelfCheckoutFieldName,
  SelfCheckoutFormValues,
  SelfCheckoutLoadStatus,
  SelfCheckoutSubmitFailure,
  SelfCheckoutSubmitOutcome,
  SelfCheckoutTextFieldName,
} from "./SelfCheckoutTypes"
import {
  describeSubmitFailure,
  INITIAL_FORM_VALUES,
  maskCnpjInput,
  resolveSelectedCycle,
  validateSelfCheckoutForm,
} from "../utils/selfCheckoutForm"

export type SelfCheckoutContextValue = {
  loadStatus: SelfCheckoutLoadStatus
  loadErrorMessage: string | null
  options: SelfCheckoutOptionsDTO | null
  selectedCycle: SelfCheckoutCycle | null
  /** Token do pedido já criado; com ele, o pagamento é gerado sem criar outro pedido. */
  orderToken: string | null
  /** Verdadeiro enquanto busca razão social e nome fantasia pelo CNPJ digitado. */
  isLookingUpCompany: boolean
  /** Valida os campos do pedido sem enviar; devolve o primeiro inválido (ou `null`). */
  validate: () => SelfCheckoutFieldName | null
  /** Valida só os campos da fase (Continuar) e devolve o primeiro inválido entre eles. */
  validatePhase: (fields: readonly SelfCheckoutFieldName[]) => SelfCheckoutFieldName | null
  values: SelfCheckoutFormValues
  fieldErrors: SelfCheckoutFieldErrors
  /** Chamado ao sair de um campo: a partir daí ele já mostra o erro se estiver vazio ou inválido. */
  markFieldTouched: (field: SelfCheckoutFieldName) => void
  submitFailure: SelfCheckoutSubmitFailure | null
  isSubmitting: boolean
  /** Verdadeiro entre a criação da adesão e a troca de página; mantém o envio travado. */
  isRedirecting: boolean
  reload: () => Promise<void>
  selectCycle: (cycle: SelfCheckoutCycle) => void
  setFieldValue: (field: SelfCheckoutTextFieldName, value: string) => void
  setTermsAccepted: (accepted: boolean) => void
  setBillingType: (billingType: SelfCheckoutBillingType) => void
  /** Define a quantidade de usuários ou times adicionais, limitada de 0 ao máximo do contrato. */
  setExtraQuantity: (kind: "extraUsers" | "extraTeams", quantity: number) => void
  /** Texto digitado no campo de cupom (ainda não validado). */
  couponInput: string
  couponStatus: SelfCheckoutCouponStatus
  /** Desconto confirmado pelo servidor para o plano e a forma de pagamento atuais. */
  couponQuote: SelfCheckoutCouponQuote | null
  couponMessage: string | null
  setCouponInput: (value: string) => void
  applyCoupon: () => Promise<void>
  removeCoupon: () => void
  submit: () => Promise<SelfCheckoutSubmitOutcome>
}

const SelfCheckoutContext = createContext<SelfCheckoutContextValue | null>(null)

const LOAD_KEY = "options"

export function SelfCheckoutProvider({
  children,
  service: injectedService,
}: {
  children: ReactNode
  /** Só para testes; em produção usa o serviço HTTP. */
  service?: ISelfCheckoutService
}) {
  const service = useMemo<ISelfCheckoutService>(
    () => injectedService ?? new SelfCheckoutService(),
    [injectedService],
  )
  const [loadStatus, setLoadStatus] = useState<SelfCheckoutLoadStatus>("loading")
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null)
  const [options, setOptions] = useState<SelfCheckoutOptionsDTO | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<SelfCheckoutCycle | null>(null)
  const [values, setValues] = useState<SelfCheckoutFormValues>(INITIAL_FORM_VALUES)
  const [submitErrors, setFieldErrors] = useState<SelfCheckoutFieldErrors>({})
  const [touchedFields, setTouchedFields] = useState<Partial<Record<SelfCheckoutFieldName, boolean>>>({})
  const [submitFailure, setSubmitFailure] = useState<SelfCheckoutSubmitFailure | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [orderToken, setOrderToken] = useState<string | null>(null)
  const [isLookingUpCompany, setIsLookingUpCompany] = useState(false)
  const lastLookedUpCnpj = useRef<string | null>(null)
  const [couponInput, setCouponInputState] = useState("")
  const [couponStatus, setCouponStatus] = useState<SelfCheckoutCouponStatus>("idle")
  const [couponQuote, setCouponQuote] = useState<SelfCheckoutCouponQuote | null>(null)
  const [couponMessage, setCouponMessage] = useState<string | null>(null)
  const couponLock = useRef(false)

  const loadInFlight = useRef<string | null>(null)
  const loadSucceeded = useRef<string | null>(null)
  const submitLock = useRef(false)

  const loadOptions = useCallback(
    async ({ silent }: { silent: boolean }) => {
      if (loadInFlight.current === LOAD_KEY) return
      if (!silent && loadSucceeded.current === LOAD_KEY) return

      loadInFlight.current = LOAD_KEY
      if (!silent) {
        setLoadStatus("loading")
        setLoadErrorMessage(null)
      }
      try {
        const response = await service.getOptions()
        setOptions(response)
        setSelectedCycle((current) => resolveSelectedCycle(response.cycles, current))
        setLoadStatus("ready")
        loadSucceeded.current = LOAD_KEY
      } catch (error) {
        if (silent) return
        console.error("[SelfCheckoutContext][loadOptions]", error)
        setLoadErrorMessage(toUserToastMessage(error))
        setLoadStatus("error")
      } finally {
        loadInFlight.current = null
      }
    },
    [service],
  )

  const reload = useCallback(async () => {
    loadSucceeded.current = null
    await loadOptions({ silent: false })
  }, [loadOptions])

  useEffect(() => {
    void loadOptions({ silent: false })
  }, [loadOptions])

  /** O desconto vale para um plano e uma forma de pagamento; ao mudar um deles o cupom sai. */
  const dropAppliedCoupon = useCallback((message: string | null) => {
    setCouponQuote(null)
    setCouponStatus("idle")
    setCouponMessage(message)
    setValues((current) => (current.couponCode ? { ...current, couponCode: "" } : current))
  }, [])

  const selectCycle = useCallback(
    (cycle: SelfCheckoutCycle) => {
      setSelectedCycle(cycle)
      setFieldErrors((current) => ({ ...current, cycle: undefined }))
      setSubmitFailure(null)
      const nextOption = options?.cycles.find((option) => option.cycle === cycle)
      if (!nextOption?.creditCardTotal) {
        setValues((current) =>
          current.billingType === "PIX" ? current : { ...current, billingType: "PIX" },
        )
      }
      if (couponQuote) dropAppliedCoupon("O cupom foi removido porque o plano mudou. Aplique novamente.")
    },
    [couponQuote, dropAppliedCoupon, options],
  )

  const setBillingType = useCallback(
    (billingType: SelfCheckoutBillingType) => {
      setValues((current) => ({ ...current, billingType }))
      setSubmitFailure(null)
      if (couponQuote) {
        dropAppliedCoupon("O cupom foi removido porque a forma de pagamento mudou. Aplique novamente.")
      }
    },
    [couponQuote, dropAppliedCoupon],
  )

  const setExtraQuantity = useCallback((kind: "extraUsers" | "extraTeams", quantity: number) => {
    const safe = Number.isFinite(quantity) ? Math.trunc(quantity) : 0
    const clamped = Math.min(SELF_CHECKOUT_EXTRAS_MAX, Math.max(0, safe))
    setValues((current) => (current[kind] === clamped ? current : { ...current, [kind]: clamped }))
    setSubmitFailure(null)
  }, [])

  const setCouponInput = useCallback((value: string) => {
    setCouponInputState(value.slice(0, SELF_CHECKOUT_COUPON_MAX_LENGTH))
    setCouponStatus((current) => (current === "error" ? "idle" : current))
    setCouponMessage(null)
  }, [])

  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim()
    if (couponLock.current || !selectedCycle) return
    if (!code) {
      setCouponStatus("error")
      setCouponMessage("Informe o código do cupom.")
      return
    }

    couponLock.current = true
    setCouponStatus("loading")
    setCouponMessage(null)
    try {
      const quote = await service.quoteCoupon({
        couponCode: code,
        cycle: selectedCycle,
        ...(values.billingType === "CREDIT_CARD" ? { billingType: values.billingType } : {}),
      })
      setCouponQuote(quote)
      setCouponStatus("applied")
      setValues((current) => ({ ...current, couponCode: quote.code }))
    } catch (error) {
      setCouponQuote(null)
      setCouponStatus("error")
      setCouponMessage(toUserToastMessage(error))
    } finally {
      couponLock.current = false
    }
  }, [couponInput, selectedCycle, service, values.billingType])

  const removeCoupon = useCallback(() => {
    setCouponInputState("")
    dropAppliedCoupon(null)
  }, [dropAppliedCoupon])

  /** Preenche razão social e nome fantasia pelo CNPJ, sem sobrescrever o que o cliente já digitou. */
  const lookupCompany = useCallback(
    async (cnpj: string) => {
      const digits = cnpj.replace(/\D/g, "")
      if (digits.length !== 14 || !isValidCNPJ(digits) || lastLookedUpCnpj.current === digits) return
      lastLookedUpCnpj.current = digits
      setIsLookingUpCompany(true)
      try {
        const company = await service.lookupCompany(digits)
        if (!company) return
        setValues((current) => ({
          ...current,
          companyLegalName: current.companyLegalName.trim() ? current.companyLegalName : company.legalName,
          companyTradeName: current.companyTradeName.trim()
            ? current.companyTradeName
            : (company.tradeName ?? current.companyTradeName),
        }))
      } catch {
        // a consulta é só uma ajuda: se falhar, o cliente preenche à mão
      } finally {
        setIsLookingUpCompany(false)
      }
    },
    [service],
  )

  const setFieldValue = useCallback(
    (field: SelfCheckoutTextFieldName, value: string) => {
      const next =
        field === "phone"
          ? maskPhone(value)
          : field === "cnpj"
            ? maskCnpjInput(value)
            : value
      setValues((current) => ({ ...current, [field]: next }))
      if (field !== "website") {
        setFieldErrors((current) => ({ ...current, [field]: undefined }))
      }
      if (field === "cnpj") void lookupCompany(next)
    },
    [lookupCompany],
  )

  const setTermsAccepted = useCallback((accepted: boolean) => {
    setValues((current) => ({ ...current, termsAccepted: accepted }))
    setFieldErrors((current) => ({ ...current, termsAccepted: undefined }))
    setSubmitFailure(null)
  }, [])

  const validate = useCallback((): SelfCheckoutFieldName | null => {
    const validation = validateSelfCheckoutForm(values, selectedCycle)
    if (validation.ok) return null
    setFieldErrors(validation.errors)
    return validation.firstInvalidField
  }, [selectedCycle, values])

  const validatePhase = useCallback(
    (fields: readonly SelfCheckoutFieldName[]): SelfCheckoutFieldName | null => {
      // Marcar como tocados mostra os erros dessas fases; os campos das fases seguintes continuam limpos.
      setTouchedFields((current) => {
        const next = { ...current }
        for (const field of fields) next[field] = true
        return next
      })
      const validation = validateSelfCheckoutForm(values, selectedCycle)
      if (validation.ok) return null
      return fields.find((field) => validation.errors[field]) ?? null
    },
    [selectedCycle, values],
  )

  const submit = useCallback(async (): Promise<SelfCheckoutSubmitOutcome> => {
    if (submitLock.current || isRedirecting) return { kind: "ignored" }

    const validation = validateSelfCheckoutForm(values, selectedCycle)
    if (!validation.ok) {
      setFieldErrors(validation.errors)
      setSubmitFailure(null)
      return { kind: "invalid", firstInvalidField: validation.firstInvalidField }
    }

    submitLock.current = true
    setIsSubmitting(true)
    setFieldErrors({})
    setSubmitFailure(null)
    try {
      const { token } = await service.create(validation.request)
      setOrderToken(token)
      setIsRedirecting(true)
      return { kind: "created", token }
    } catch (error) {
      const failure = describeSubmitFailure(error)
      if (failure.code === "UNKNOWN") console.error("[SelfCheckoutContext][submit]", error)
      setSubmitFailure(failure)
      if (failure.code === SELF_CHECKOUT_ERROR_CODES.CYCLE_UNAVAILABLE) {
        void loadOptions({ silent: true })
      }
      return { kind: "failed", failure }
    } finally {
      submitLock.current = false
      setIsSubmitting(false)
    }
  }, [isRedirecting, loadOptions, selectedCycle, service, values])

  /** Marca o campo como visitado: depois disso ele mostra o erro (vermelho) assim que está inválido. */
  const markFieldTouched = useCallback((field: SelfCheckoutFieldName) => {
    setTouchedFields((current) => (current[field] ? current : { ...current, [field]: true }))
  }, [])

  // Erros do envio + erros dos campos já visitados, calculados com a mesma validação do envio.
  const fieldErrors = useMemo<SelfCheckoutFieldErrors>(() => {
    const touchedNames = Object.keys(touchedFields) as SelfCheckoutFieldName[]
    if (touchedNames.length === 0) return submitErrors
    const validation = validateSelfCheckoutForm(values, selectedCycle)
    if (validation.ok) return submitErrors
    const merged: SelfCheckoutFieldErrors = { ...submitErrors }
    for (const name of touchedNames) {
      if (touchedFields[name] && validation.errors[name]) merged[name] = validation.errors[name]
    }
    return merged
  }, [selectedCycle, submitErrors, touchedFields, values])

  const value = useMemo<SelfCheckoutContextValue>(
    () => ({
      loadStatus,
      loadErrorMessage,
      options,
      selectedCycle,
      orderToken,
      isLookingUpCompany,
      validate,
      validatePhase,
      values,
      fieldErrors,
      markFieldTouched,
      submitFailure,
      isSubmitting,
      isRedirecting,
      reload,
      selectCycle,
      setFieldValue,
      setTermsAccepted,
      setBillingType,
      setExtraQuantity,
      couponInput,
      couponStatus,
      couponQuote,
      couponMessage,
      setCouponInput,
      applyCoupon,
      removeCoupon,
      submit,
    }),
    [
      loadStatus,
      loadErrorMessage,
      options,
      selectedCycle,
      orderToken,
      isLookingUpCompany,
      validate,
      validatePhase,
      values,
      fieldErrors,
      markFieldTouched,
      submitFailure,
      isSubmitting,
      isRedirecting,
      reload,
      selectCycle,
      setFieldValue,
      setTermsAccepted,
      setBillingType,
      setExtraQuantity,
      couponInput,
      couponStatus,
      couponQuote,
      couponMessage,
      setCouponInput,
      applyCoupon,
      removeCoupon,
      submit,
    ],
  )

  return <SelfCheckoutContext.Provider value={value}>{children}</SelfCheckoutContext.Provider>
}

export function useSelfCheckoutContext(): SelfCheckoutContextValue {
  const context = useContext(SelfCheckoutContext)
  if (!context) throw new Error("useSelfCheckoutContext must be used within SelfCheckoutProvider")
  return context
}
