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

import { maskPhone } from "@/lib/masks"
import {
  SELF_CHECKOUT_ERROR_CODES,
  type SelfCheckoutCycle,
  type SelfCheckoutOptionsDTO,
} from "@/lib/self-checkout/contracts"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import type { ISelfCheckoutService } from "../services/ISelfCheckoutService"
import { SelfCheckoutService } from "../services/SelfCheckoutService"
import type {
  SelfCheckoutFieldErrors,
  SelfCheckoutFormValues,
  SelfCheckoutLoadStatus,
  SelfCheckoutSubmitFailure,
  SelfCheckoutSubmitOutcome,
} from "./SelfCheckoutTypes"
import {
  describeSubmitFailure,
  INITIAL_FORM_VALUES,
  resolveSelectedCycle,
  validateSelfCheckoutForm,
} from "../utils/selfCheckoutForm"

export type SelfCheckoutContextValue = {
  loadStatus: SelfCheckoutLoadStatus
  loadErrorMessage: string | null
  options: SelfCheckoutOptionsDTO | null
  selectedCycle: SelfCheckoutCycle | null
  values: SelfCheckoutFormValues
  fieldErrors: SelfCheckoutFieldErrors
  submitFailure: SelfCheckoutSubmitFailure | null
  isSubmitting: boolean
  /** Verdadeiro entre a criação da adesão e a troca de página; mantém o envio travado. */
  isRedirecting: boolean
  reload: () => Promise<void>
  selectCycle: (cycle: SelfCheckoutCycle) => void
  setFieldValue: (field: keyof SelfCheckoutFormValues, value: string) => void
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
  const [fieldErrors, setFieldErrors] = useState<SelfCheckoutFieldErrors>({})
  const [submitFailure, setSubmitFailure] = useState<SelfCheckoutSubmitFailure | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

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

  const selectCycle = useCallback((cycle: SelfCheckoutCycle) => {
    setSelectedCycle(cycle)
    setFieldErrors((current) => ({ ...current, cycle: undefined }))
    setSubmitFailure(null)
  }, [])

  const setFieldValue = useCallback((field: keyof SelfCheckoutFormValues, value: string) => {
    const next = field === "phone" ? maskPhone(value) : value
    setValues((current) => ({ ...current, [field]: next }))
    if (field !== "website") {
      setFieldErrors((current) => ({ ...current, [field]: undefined }))
    }
  }, [])

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

  const value = useMemo<SelfCheckoutContextValue>(
    () => ({
      loadStatus,
      loadErrorMessage,
      options,
      selectedCycle,
      values,
      fieldErrors,
      submitFailure,
      isSubmitting,
      isRedirecting,
      reload,
      selectCycle,
      setFieldValue,
      submit,
    }),
    [
      loadStatus,
      loadErrorMessage,
      options,
      selectedCycle,
      values,
      fieldErrors,
      submitFailure,
      isSubmitting,
      isRedirecting,
      reload,
      selectCycle,
      setFieldValue,
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
