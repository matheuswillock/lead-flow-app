"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { BackofficeBethaniaService } from "./BackofficeBethaniaService"
import type { BackofficeBethaniaServiceContract, BethaniaEvent, BethaniaLog, BethaniaOverview, BethaniaPauseInput } from "./BackofficeBethaniaTypes"

type BethaniaState = {
  overview: BethaniaOverview | null
  events: BethaniaEvent[]
  logs: BethaniaLog[]
  selectedEventType: string
  logsPage: number
  logsPageSize: number
  logsTotal: number
  isLoading: boolean
  isSaving: boolean
  error: string | null
  setSelectedEventType(eventType: string): void
  setLogsPage(page: number): void
  togglePause(input: BethaniaPauseInput): Promise<void>
  setSenderUrl(webhookUrl: string): Promise<void>
}

const BethaniaContext = createContext<BethaniaState | null>(null)

const DEFAULT_SERVICE = new BackofficeBethaniaService()

export function BackofficeBethaniaProvider({ children, service = DEFAULT_SERVICE }: { children: ReactNode; service?: BackofficeBethaniaServiceContract }) {
  const [overview, setOverview] = useState<BethaniaOverview | null>(null)
  const [events, setEvents] = useState<BethaniaEvent[]>([])
  const [logs, setLogs] = useState<BethaniaLog[]>([])
  const [selectedEventType, setSelectedEventTypeState] = useState("")
  const [logsPage, setLogsPage] = useState(1)
  const [logsPageSize, setLogsPageSize] = useState(25)
  const [logsTotal, setLogsTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void service.getOverview().then((data) => {
      if (!active) return
      setOverview(data)
      setEvents(data.events)
      setSelectedEventTypeState((current) => current || data.events[0]?.eventType || "")
      setIsLoading(false)
    }).catch(() => {
      if (!active) return
      setError("Não foi possível carregar os dados da Bethânia.")
      setIsLoading(false)
    })
    return () => { active = false }
  }, [service])

  useEffect(() => {
    if (!selectedEventType) return
    let active = true
    void service.listLogs({ eventType: selectedEventType, page: logsPage, pageSize: logsPageSize }).then((result) => {
      if (!active) return
      setLogs(result.logs)
      setLogsPageSize(result.pageSize)
      setLogsTotal(result.total)
    }).catch(() => {
      if (active) setLogs([])
    })
    return () => { active = false }
  }, [logsPage, logsPageSize, selectedEventType, service])

  const selectEventType = useCallback((eventType: string) => {
    setSelectedEventTypeState(eventType)
    setLogsPage(1)
  }, [])

  const togglePause = useCallback(async (input: BethaniaPauseInput) => {
    setIsSaving(true)
    try {
      await service.setPause(input)
      if (input.scope === "global") {
        setOverview((current) => current ? { ...current, paused: input.paused } : current)
      } else {
        setEvents((current) => current.map((event) => event.eventType === input.eventType ? { ...event, paused: input.paused } : event))
      }
      toast.success(input.paused ? "Pausa ativada" : "Pausa removida")
    } catch {
      toast.error("Não foi possível atualizar a pausa.")
    } finally {
      setIsSaving(false)
    }
  }, [service])

  const setSenderUrl = useCallback(async (webhookUrl: string) => {
    setIsSaving(true)
    try {
      await service.setSenderUrl(webhookUrl)
      setOverview((current) => current ? {
        ...current,
        sender: { ...current.sender, configured: true, webhookUrl: `${new URL(webhookUrl).origin}/` },
      } : current)
      toast.success("URL do conector atualizada")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a URL do conector.")
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [service])

  const value: BethaniaState = {
    overview, events, logs, selectedEventType, logsPage, logsPageSize, logsTotal, isLoading, isSaving, error,
    setSelectedEventType: selectEventType,
    setLogsPage,
    togglePause,
    setSenderUrl,
  }
  return <BethaniaContext.Provider value={value}>{children}</BethaniaContext.Provider>
}

export function useBackofficeBethania() {
  const context = useContext(BethaniaContext)
  if (!context) throw new Error("useBackofficeBethania deve ser usado dentro do provider")
  return context
}
