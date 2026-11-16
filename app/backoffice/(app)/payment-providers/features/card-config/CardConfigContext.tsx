"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import { runCardToggle } from "./cardConfigToggle"
import type { CardToggleOutcome } from "./cardConfigToggle"
import type {
  AbacateCardConfig,
  CardConfigEnvironment,
  ICardConfigService,
  PaymentProvider,
  ProviderVariablesConfig,
} from "./ICardConfigService"

export const CARD_CONFIG_ENVIRONMENTS: readonly CardConfigEnvironment[] = ["DEV", "PRODUCTION"]

type ConfigByEnvironment = Record<CardConfigEnvironment, AbacateCardConfig | null>
type SavingByEnvironment = Record<CardConfigEnvironment, boolean>

const EMPTY_CONFIGS: ConfigByEnvironment = { DEV: null, PRODUCTION: null }
const NOT_SAVING: SavingByEnvironment = { DEV: false, PRODUCTION: false }

interface CardConfigContextValue {
  configs: ConfigByEnvironment
  isLoading: boolean
  loadError: boolean
  saving: SavingByEnvironment
  canManage: boolean
  reload: () => Promise<void>
  toggleCard: (environment: CardConfigEnvironment, cardEnabled: boolean) => Promise<CardToggleOutcome | null>
  savePublicKey: (environment: CardConfigEnvironment, publicKey: string | null) => Promise<boolean>
  providerConfigs: Record<CardConfigEnvironment, ProviderVariablesConfig[]>
  saveProviderVariables: (
    provider: PaymentProvider,
    environment: CardConfigEnvironment,
    variables: Array<{ name: string; visibility: "PUBLIC" | "SECRET"; value?: string }>,
  ) => Promise<boolean>
}

const CardConfigContext = createContext<CardConfigContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  cardConfigService: ICardConfigService
}

export function CardConfigProvider({ children, cardConfigService }: Props) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const [configs, setConfigs] = useState<ConfigByEnvironment>(EMPTY_CONFIGS)
  const [providerConfigs, setProviderConfigs] = useState<Record<CardConfigEnvironment, ProviderVariablesConfig[]>>({ DEV: [], PRODUCTION: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState<SavingByEnvironment>(NOT_SAVING)
  const loadInFlight = useRef(false)
  const saveLocks = useRef<SavingByEnvironment>({ DEV: false, PRODUCTION: false })
  const configsRef = useRef<ConfigByEnvironment>(EMPTY_CONFIGS)

  const applyConfigs = useCallback((next: ConfigByEnvironment) => {
    configsRef.current = next
    setConfigs(next)
  }, [])

  const reload = useCallback(async () => {
    if (loadInFlight.current) return
    loadInFlight.current = true
    setIsLoading(true)
    setLoadError(false)
    try {
      const [dev, production] = await Promise.all(
        CARD_CONFIG_ENVIRONMENTS.map((environment) => cardConfigService.getAbacateCardConfig(environment)),
      )
      const [devProviders, productionProviders] = await Promise.all(
        CARD_CONFIG_ENVIRONMENTS.map((environment) => cardConfigService.getProviderConfigs?.(environment) ?? Promise.resolve([])),
      )
      applyConfigs({ DEV: dev, PRODUCTION: production })
      setProviderConfigs({ DEV: devProviders, PRODUCTION: productionProviders })
    } catch (error) {
      console.error("[CardConfigContext]", error)
      setLoadError(true)
    } finally {
      setIsLoading(false)
      loadInFlight.current = false
    }
  }, [cardConfigService, applyConfigs])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggleCard = useCallback(
    async (environment: CardConfigEnvironment, cardEnabled: boolean) => {
      const current = configsRef.current[environment]
      if (!current || saveLocks.current[environment]) return null
      saveLocks.current[environment] = true
      setSaving((prev) => ({ ...prev, [environment]: true }))
      try {
        const outcome = await runCardToggle(
          cardConfigService,
          environment,
          cardEnabled,
          current.revision
        )
        const fresh =
          outcome.status === "saved" || outcome.status === "conflict" ? outcome.config : null
        if (fresh) applyConfigs({ ...configsRef.current, [environment]: fresh })
        return outcome
      } finally {
        saveLocks.current[environment] = false
        setSaving((prev) => ({ ...prev, [environment]: false }))
      }
    },
    [cardConfigService, applyConfigs]
  )

  const savePublicKey = useCallback(async (environment: CardConfigEnvironment, publicKey: string | null) => {
    const current = configsRef.current[environment]
    if (!current || !cardConfigService.setPublicKey || saveLocks.current[environment]) return false
    saveLocks.current[environment] = true
    setSaving((prev) => ({ ...prev, [environment]: true }))
    try {
      const fresh = await cardConfigService.setPublicKey(environment, publicKey, current.revision)
      applyConfigs({ ...configsRef.current, [environment]: fresh })
      return true
    } catch (error) {
      console.error("[CardConfigContext][savePublicKey]", error)
      await reload()
      return false
    } finally {
      saveLocks.current[environment] = false
      setSaving((prev) => ({ ...prev, [environment]: false }))
    }
  }, [applyConfigs, cardConfigService, reload])

  const saveProviderVariables = useCallback(async (
    provider: PaymentProvider,
    environment: CardConfigEnvironment,
    variables: Array<{ name: string; visibility: "PUBLIC" | "SECRET"; value?: string }>,
  ) => {
    const current = providerConfigs[environment].find((item) => item.provider === provider)
    if (!current || !cardConfigService.setProviderVariables || saveLocks.current[environment]) return false
    saveLocks.current[environment] = true
    setSaving((prev) => ({ ...prev, [environment]: true }))
    try {
      const fresh = await cardConfigService.setProviderVariables(provider, environment, variables, current.revision)
      setProviderConfigs((previous) => ({
        ...previous,
        [environment]: previous[environment].map((item) => item.provider === provider ? fresh : item),
      }))
      return true
    } catch (error) {
      console.error("[CardConfigContext][saveProviderVariables]", error)
      await reload()
      return false
    } finally {
      saveLocks.current[environment] = false
      setSaving((prev) => ({ ...prev, [environment]: false }))
    }
  }, [cardConfigService, providerConfigs, reload])

  const value = useMemo(
    () => ({ configs, providerConfigs, isLoading, loadError, saving, canManage, reload, toggleCard, savePublicKey, saveProviderVariables }),
    [configs, providerConfigs, isLoading, loadError, saving, canManage, reload, toggleCard, savePublicKey, saveProviderVariables]
  )

  return <CardConfigContext.Provider value={value}>{children}</CardConfigContext.Provider>
}

export function useCardConfig(): CardConfigContextValue {
  const ctx = useContext(CardConfigContext)
  if (!ctx) throw new Error("useCardConfig must be used within CardConfigProvider")
  return ctx
}
