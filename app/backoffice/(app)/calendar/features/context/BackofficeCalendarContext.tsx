"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type {
  BackofficeCrmUserOption,
  BackofficeLeadItem,
  BackofficeLeadScheduleInput,
} from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes"
import type { IBackofficeCalendarService } from "../services/IBackofficeCalendarService"

interface BackofficeCalendarContextValue {
  leads: BackofficeLeadItem[]
  users: BackofficeCrmUserOption[]
  closers: BackofficeCrmUserOption[]
  isLoading: boolean
  error: string | null
  timezone: string
  refresh: () => Promise<void>
  getAvailability: IBackofficeCalendarService["getAvailability"]
  scheduleLead: (leadId: string, input: BackofficeLeadScheduleInput) => Promise<void>
  cancelSchedule: (leadId: string) => Promise<void>
  getAttendees: IBackofficeCalendarService["getAttendees"]
}

export const BackofficeCalendarContext = createContext<
  BackofficeCalendarContextValue | undefined
>(
  undefined
)

export function BackofficeCalendarProvider({
  children,
  service,
}: {
  children: ReactNode
  service: IBackofficeCalendarService
}) {
  const { user } = useBackofficeUser()
  const [leads, setLeads] = useState<BackofficeLeadItem[]>([])
  const [users, setUsers] = useState<BackofficeCrmUserOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current

    const request = (async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [leadData, userData] = await Promise.all([
          service.listLeads(),
          service.listUsers(),
        ])
        setLeads(leadData)
        setUsers(userData)
      } catch (err) {
        console.error("[BackofficeCalendarContext][refresh]", err)
        setError(toUserToastMessage(err))
      } finally {
        setIsLoading(false)
        inFlightRef.current = null
      }
    })()

    inFlightRef.current = request
    return request
  }, [service])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const scheduleLead = useCallback(
    async (leadId: string, input: BackofficeLeadScheduleInput) => {
      const updated = await service.scheduleLead(leadId, input)
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updated : lead)))
      toast.success("Agendamento salvo")
    },
    [service]
  )

  const getAvailability = useCallback(
    (input: Parameters<IBackofficeCalendarService["getAvailability"]>[0]) =>
      service.getAvailability(input),
    [service]
  )

  const cancelSchedule = useCallback(
    async (leadId: string) => {
      const updated = await service.cancelSchedule(leadId)
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updated : lead)))
      toast.success("Agendamento cancelado")
    },
    [service]
  )

  const getAttendees = useCallback(
    (leadId: string) => service.getAttendees(leadId),
    [service]
  )

  const closers = useMemo(() => users.filter((userOption) => userOption.isCloser), [users])

  const value = useMemo<BackofficeCalendarContextValue>(
    () => ({
      leads,
      users,
      closers,
      isLoading,
      error,
      timezone: user?.timezone ?? "America/Sao_Paulo",
      refresh,
      getAvailability,
      scheduleLead,
      cancelSchedule,
      getAttendees,
    }),
    [
      leads,
      users,
      closers,
      isLoading,
      error,
      user?.timezone,
      refresh,
      getAvailability,
      scheduleLead,
      cancelSchedule,
      getAttendees,
    ]
  )

  return (
    <BackofficeCalendarContext.Provider value={value}>
      {children}
    </BackofficeCalendarContext.Provider>
  )
}
