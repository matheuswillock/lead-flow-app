"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type {
  IBackofficeDashboardService,
  BackofficeClientSummary,
  BackofficePaymentSummary,
} from "../services/IBackofficeDashboardService"

interface DashboardState {
  totalClients: number
  pendingPayments: number
  confirmedPayments: number
  totalRevenue: number
  isLoading: boolean
  error: string | null
}

interface DashboardContextValue extends DashboardState {
  refresh: () => void
}

const BackofficeDashboardContext = createContext<DashboardContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  dashboardService: IBackofficeDashboardService
}

export function BackofficeDashboardProvider({ children, dashboardService }: Props) {
  const [state, setState] = useState<DashboardState>({
    totalClients: 0,
    pendingPayments: 0,
    confirmedPayments: 0,
    totalRevenue: 0,
    isLoading: true,
    error: null,
  })
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setState((s) => ({ ...s, isLoading: true, error: null }))

    try {
      const [clients, payments] = await Promise.all([
        dashboardService.fetchClients(),
        dashboardService.fetchPayments(),
      ])

      const pending = payments.filter(
        (p) => p.status === "PENDING" || p.status === "AWAITING_RISK_ANALYSIS"
      ).length
      const confirmed = payments.filter(
        (p) => p.status === "RECEIVED" || p.status === "CONFIRMED"
      ).length
      const revenue = payments
        .filter((p) => p.status === "RECEIVED" || p.status === "CONFIRMED")
        .reduce((sum, p) => sum + Number(p.amount), 0)

      setState({
        totalClients: clients.length,
        pendingPayments: pending,
        confirmedPayments: confirmed,
        totalRevenue: revenue,
        isLoading: false,
        error: null,
      })
    } catch (err) {
      console.error("[BackofficeDashboardContext]", err)
      setState((s) => ({
        ...s,
        isLoading: false,
        error: "Erro ao carregar dados do dashboard",
      }))
    } finally {
      inFlight.current = false
    }
  }, [dashboardService])

  useEffect(() => {
    load()
  }, [load])

  return (
    <BackofficeDashboardContext.Provider value={{ ...state, refresh: load }}>
      {children}
    </BackofficeDashboardContext.Provider>
  )
}

export function useBackofficeDashboard(): DashboardContextValue {
  const ctx = useContext(BackofficeDashboardContext)
  if (!ctx) throw new Error("useBackofficeDashboard must be used within BackofficeDashboardProvider")
  return ctx
}
