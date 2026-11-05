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
        CARD_CONFIG_ENVIRONMENTS.map((environment) =>
          cardConfigService.getAbacateCardConfig(environment)
        )
      )
      applyConfigs({ DEV: dev, PRODUCTION: production })
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

  const value = useMemo(
    () => ({ configs, isLoading, loadError, saving, canManage, reload, toggleCard }),
    [configs, isLoading, loadError, saving, canManage, reload, toggleCard]
  )

  return <CardConfigContext.Provider value={value}>{children}</CardConfigContext.Provider>
}

export function useCardConfig(): CardConfigContextValue {
  const ctx = useContext(CardConfigContext)
  if (!ctx) throw new Error("useCardConfig must be used within CardConfigProvider")
  return ctx
}
