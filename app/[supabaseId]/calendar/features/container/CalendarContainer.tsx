"use client"

import * as React from "react"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { toUserToastMessage, toastUserError } from "@/lib/ui/to-user-toast-message"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { CirclePlus } from "@/components/animate-ui/icons/circle-plus"
import { CheckCircle2, XCircle, HelpCircle, Clock, MoreVertical, BadgeCheck, BadgeIcon, Loader2, CalendarIcon } from "lucide-react"
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog"
import { TaskFormDialog, type TaskCreatedPayload } from "@/components/task-form-dialog"
import { TaskCard, type TaskItem } from "@/components/task-card"
import useBoardContext from "@/app/[supabaseId]/board/features/context/BoardHook"
import {
  ScheduleMeetingDialog,
  type ScheduleMeetingSuccessPayload,
} from "@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog"
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes"
import { getLeadStatusLabel } from "@/lib/lead-status"
import { isMeetingFollowUpOverdue, canConfirmMeetingPresence, isMeetingPresenceConfirmationDue, getMeetingPresenceBadgeClass, getMeetingPresenceBadgeLabel, getMeetingPresenceAlertLabel } from "@/lib/lead-meeting"
import { CalendarDayButton } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useTeamContext } from "@/app/context/TeamContext"
import { Separator } from "@/components/ui/separator"
import { useTimezone } from "@/app/context/TimezoneContext"
import {
  formatIntimezone,
  formatLocalDateValue,
  getMinutesInTz,
  nowInTz,
  parseDateKeyToUtc,
} from "@/lib/dates"
import { leadStatusTransitionClient } from "@/lib/services/leadStatusTransitionClient"
import { API_CLIENT_BASE } from "@/lib/route-map";

type AttendeeRole = "closer" | "sdr" | "lead" | "extra"

type ScheduleAttendee = {
  email: string
  displayName: string | null
  role: AttendeeRole
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction"
}

type AttendeesByLead = Record<string, { attendees: ScheduleAttendee[]; hasGoogleData: boolean }>

const ROLE_ORDER: AttendeeRole[] = ["closer", "sdr", "lead", "extra"]

const normalizeEmail = (value?: string | null) => value?.toLowerCase().trim() ?? ""

const toSafeResponseStatus = (
  status: unknown
): ScheduleAttendee["responseStatus"] => {
  if (status === "accepted") return "accepted"
  if (status === "declined") return "declined"
  if (status === "tentative") return "tentative"
  return "needsAction"
}

const buildFallbackAttendees = (lead: Lead): ScheduleAttendee[] => {
  const roleMap = new Map<string, AttendeeRole>()

  const closerEmail = normalizeEmail(lead.closer?.email)
  const sdrEmail = normalizeEmail(lead.assignee?.email)
  const leadEmail = normalizeEmail(lead.email)

  if (closerEmail) roleMap.set(closerEmail, "closer")
  if (sdrEmail && sdrEmail !== closerEmail) roleMap.set(sdrEmail, "sdr")
  if (leadEmail) roleMap.set(leadEmail, "lead")

  return Array.from(roleMap.entries()).map(([email, role]) => ({
    email,
    displayName: null,
    role,
    responseStatus: "needsAction",
  }))
}

const mergeAttendeesWithFallback = (
  lead: Lead,
  attendeesFromApi: unknown
): ScheduleAttendee[] => {
  const merged = new Map<string, ScheduleAttendee>()

  for (const attendee of buildFallbackAttendees(lead)) {
    merged.set(attendee.email, attendee)
  }

  if (Array.isArray(attendeesFromApi)) {
    for (const rawAttendee of attendeesFromApi) {
      const attendee = rawAttendee as Partial<ScheduleAttendee>
      const email = normalizeEmail(attendee.email)
      if (!email) continue

      const existing = merged.get(email)
      const role = attendee.role ?? existing?.role ?? "extra"

      merged.set(email, {
        email,
        displayName: attendee.displayName ?? existing?.displayName ?? null,
        role,
        responseStatus: toSafeResponseStatus(attendee.responseStatus),
      })
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  )
}

const RSVP_LABEL: Record<ScheduleAttendee["responseStatus"], string> = {
  accepted: "Confirmado",
  declined: "Recusou",
  tentative: "Talvez",
  needsAction: "Aguardando",
}

const ROLE_LABEL: Record<AttendeeRole, string> = {
  closer: "Closer",
  sdr: "SDR",
  lead: "Lead",
  extra: "Convidado",
}

const RSVP_COLOR: Record<ScheduleAttendee["responseStatus"], string> = {
  accepted: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  declined: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
  tentative: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
  needsAction: "border-muted-foreground/40 bg-transparent text-muted-foreground",
}

const RSVP_ICON: Record<ScheduleAttendee["responseStatus"], React.ElementType> = {
  accepted: CheckCircle2,
  declined: XCircle,
  tentative: HelpCircle,
  needsAction: Clock,
}

const SLOT_MINUTES = 30
const ALL_TIME_SLOTS = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => {
  const totalMinutes = index * SLOT_MINUTES
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
})

const getCalendarDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`

const getNextSlotTime = (tz: string) => {
  const now = nowInTz(tz)
  const totalMinutes = getMinutesInTz(now, tz)
  const rounded = Math.ceil(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES
  const clamped = Math.min(rounded, 24 * 60 - SLOT_MINUTES)
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

const formatTime = (date: Date, tz: string) => formatIntimezone(date, "HH:mm", tz)

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map((part) => Number(part))
  return hours * 60 + minutes
}

const dateToMinutes = (date: Date, tz: string) => getMinutesInTz(date, tz)

const getSlotIndex = (minutes: number) => Math.floor(minutes / SLOT_MINUTES)

const isWithinSlot = (meetingDate: Date, slotStart: string, tz: string) => {
  const startMinutes = timeToMinutes(slotStart)
  const meetingMinutes = dateToMinutes(meetingDate, tz)
  return getSlotIndex(meetingMinutes) === getSlotIndex(startMinutes)
}

const formatDateRange = (from: Date, to: Date, tz: string) => {
  const day = formatIntimezone(from, "dd/MM/yyyy", tz)
  return `${day} ${formatTime(from, tz)} - ${formatTime(to, tz)}`
}

const getCloserLabel = (lead: Lead, closersById: Map<string, string>) =>
  lead.closer?.fullName ||
  lead.closer?.email ||
  (lead.closerId ? closersById.get(lead.closerId) : undefined) ||
  "Sem closer"

const getStatusLabel = (status: Lead["status"]) =>
  status ? getLeadStatusLabel(status) : "Rascunho"

type CalendarEventType = "meeting" | "future_sale" | "lead_time"

type CalendarEventItem = {
  type: CalendarEventType
  lead: Lead
  date: Date
}

type CalendarSourceFilterValue = "meetings" | "tasks"
type CalendarPriorityFilterValue = "urgent" | "overdue"
type CalendarMeetingStatusFilterValue = "scheduled" | "completed" | "canceled" | "overdue"

const getEventPriority = (type: CalendarEventType) => {
  if (type === "meeting") return 0
  if (type === "future_sale") return 1
  return 2
}

type CalendarContainerProps = {
  calendarMonth: Date
  onCalendarMonthChange: (month: Date) => void
}

export function CalendarContainer({ calendarMonth, onCalendarMonthChange }: CalendarContainerProps) {
  const { tz } = useTimezone()
  const {
    data,
    isLoading,
    user,
    userLoading,
    open,
    setOpen,
    selected,
    handleCardClick,
    refreshLeads,
    finalizeContract,
    patchLead,
  } = useBoardContext()

  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [selectedTime, setSelectedTime] = React.useState<string | null>(() => getNextSlotTime(tz))
  const [leadSearchFilter, setLeadSearchFilter] = React.useState("")
  const [closerFilter, setCloserFilter] = React.useState<string[]>([])
  const [sourceFilter, setSourceFilter] = React.useState<CalendarSourceFilterValue[]>(["meetings", "tasks"])
  const [priorityFilter, setPriorityFilter] = React.useState<CalendarPriorityFilterValue[]>([])
  const [meetingStatusFilter, setMeetingStatusFilter] = React.useState<CalendarMeetingStatusFilterValue[]>([])
  const [leadPickerOpen, setLeadPickerOpen] = React.useState(false)
  const [leadToSchedule, setLeadToSchedule] = React.useState<Lead | null>(null)
  const [scheduleDialogMode, setScheduleDialogMode] = React.useState<"create" | "reschedule">("create")
  const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false)
  const [leadPickerQuery, setLeadPickerQuery] = React.useState("")
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [leadToCancel, setLeadToCancel] = React.useState<Lead | null>(null)
  const [meetingHealdSavingId, setMeetingHealdSavingId] = React.useState<string | null>(null)
  const [meetingPresenceConfirmSavingId, setMeetingPresenceConfirmSavingId] = React.useState<string | null>(null)
  const [attendeesByLead, setAttendeesByLead] = React.useState<AttendeesByLead>({})
  const [attendeesLoading, setAttendeesLoading] = React.useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false)
  const [taskDialogLead, setTaskDialogLead] = React.useState<Lead | null>(null)
  const [editingTask, setEditingTask] = React.useState<TaskItem | null>(null)
  const [tasks, setTasks] = React.useState<TaskItem[]>([])
  const [tasksLoading, setTasksLoading] = React.useState(false)
  const [monthTasks, setMonthTasks] = React.useState<TaskItem[]>([])
  const [suppressLeadDialogOpen, setSuppressLeadDialogOpen] = React.useState(false)
  const params = useParams()
  const supabaseId = params.supabaseId as string | undefined
  const { activeTeamId, activeFunctions, isTeamMaster, activeRole } = useTeamContext()
  const timeListRef = React.useRef<HTMLDivElement | null>(null)
  const suppressLeadDialogTimerRef = React.useRef<number | null>(null)

  const blockLeadDialogOpen = React.useCallback(() => {
    setSuppressLeadDialogOpen(true)
    if (suppressLeadDialogTimerRef.current) {
      window.clearTimeout(suppressLeadDialogTimerRef.current)
    }
    suppressLeadDialogTimerRef.current = window.setTimeout(() => {
      setSuppressLeadDialogOpen(false)
      suppressLeadDialogTimerRef.current = null
    }, 500)
  }, [])

  React.useEffect(() => {
    return () => {
      if (suppressLeadDialogTimerRef.current) {
        window.clearTimeout(suppressLeadDialogTimerRef.current)
      }
    }
  }, [])

  const canToggleMeetingHeald = React.useMemo(() => {
    return isTeamMaster || activeFunctions.includes("CLOSER")
  }, [isTeamMaster, activeFunctions])

  const isRestrictedToOwnEvents = !isTeamMaster
    && activeRole !== "manager"
    && activeRole !== "backoffice"

  const handleToggleMeetingHeald = React.useCallback(
    async (lead: Lead, checked: boolean) => {
      if (!supabaseId || !activeTeamId) return
      if (lead.status !== "scheduled") return
      if (!canToggleMeetingHeald) return

      const previous = (lead.meetingHeald ?? "no") as "yes" | "no"
      const next = checked ? ("yes" as const) : ("no" as const)

      setMeetingHealdSavingId(lead.id)
      patchLead?.(lead.id, { meetingHeald: next })

      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
          body: JSON.stringify({ meetingHeald: next }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Não foi possível atualizar a reunião.")
        }

        const serverValue = result?.result?.meetingHeald ?? next
        patchLead?.(lead.id, { meetingHeald: serverValue })
      } catch (err) {
        patchLead?.(lead.id, { meetingHeald: previous })
        toast.warning(
          toUserToastMessage(err),
        )
      } finally {
        setMeetingHealdSavingId(null)
      }
    },
    [supabaseId, activeTeamId, canToggleMeetingHeald, patchLead],
  )

  const canConfirmPresenceForLead = React.useCallback(
    (lead: Lead) => {
      if (!user?.id) return false
      if (
        !canConfirmMeetingPresence({
          status: lead.status,
          meetingDate: lead.meetingDate,
          isTransfer: lead.isTransfer,
        })
      ) {
        return false
      }
      const isAssignedSdr = lead.assignedTo === user.id
      const isAssignedCloser = lead.closerId === user.id
      return (
        isTeamMaster ||
        activeRole === "manager" ||
        activeRole === "backoffice" ||
        isAssignedSdr ||
        (activeFunctions.includes("CLOSER") && isAssignedCloser) ||
        (activeFunctions.includes("SDR") && isAssignedSdr)
      )
    },
    [user?.id, isTeamMaster, activeRole, activeFunctions],
  )

  const handleConfirmMeetingPresence = React.useCallback(
    async (lead: Lead) => {
      if (!supabaseId || !activeTeamId) return
      if (!canConfirmPresenceForLead(lead)) return
      if (lead.meetingPresenceConfirmed === true) return

      setMeetingPresenceConfirmSavingId(lead.id)
      patchLead?.(lead.id, { meetingPresenceConfirmed: true })

      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
          body: JSON.stringify({ meetingPresenceConfirmed: true }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Não foi possível confirmar a agenda.")
        }

        patchLead?.(lead.id, {
          meetingPresenceConfirmed: true,
          meetingPresenceConfirmedAt:
            result.result?.meetingPresenceConfirmedAt ?? new Date().toISOString(),
        })
        toast.success("Agenda confirmada com o lead")
      } catch (err) {
        patchLead?.(lead.id, { meetingPresenceConfirmed: false })
        toast.warning(
          toUserToastMessage(err),
        )
      } finally {
        setMeetingPresenceConfirmSavingId(null)
      }
    },
    [supabaseId, activeTeamId, canConfirmPresenceForLead, patchLead],
  )

  const todayKey = React.useMemo(() => formatLocalDateValue(nowInTz(tz), tz), [tz])

  const allLeads = React.useMemo(
    () => Object.values(data).flat(),
    [data]
  )

  const closers = React.useMemo(() => {
    const list = user?.usersAssociated ?? []
    return list.filter((closer) => (closer.functions || []).includes("CLOSER"))
  }, [user])

  const closersById = React.useMemo(() => {
    return new Map(closers.map((closer) => [closer.id, closer.name]))
  }, [closers])

  const calendarEvents = React.useMemo(() => {
    const events: CalendarEventItem[] = []
    allLeads.forEach((lead) => {
      if (lead.meetingDate) {
        const meetingDate = new Date(lead.meetingDate)
        if (!Number.isNaN(meetingDate.getTime())) {
          events.push({
            type: "meeting",
            lead,
            date: meetingDate,
          })
        }
      }

      if (lead.status === "future_sale" && lead.followUpAt) {
        const followUpDate = new Date(lead.followUpAt)
        if (!Number.isNaN(followUpDate.getTime())) {
          events.push({
            type: "future_sale",
            lead,
            date: followUpDate,
          })
        }
      }

      if (lead.isLeadTimeBreached && lead.leadTimeDueAt) {
        const leadTimeDueDate = new Date(lead.leadTimeDueAt)
        if (!Number.isNaN(leadTimeDueDate.getTime())) {
          events.push({
            type: "lead_time",
            lead,
            date: leadTimeDueDate,
          })
        }
      }
    })
    return events
  }, [allLeads])

  const visibleCalendarEvents = React.useMemo(() => {
    if (!isRestrictedToOwnEvents || !user?.id) return calendarEvents
    return calendarEvents.filter((event) =>
      event.lead.closerId === user.id || event.lead.assignee?.id === user.id
    )
  }, [calendarEvents, isRestrictedToOwnEvents, user?.id])

  const dayEventCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    visibleCalendarEvents.forEach((event) => {
      const key = formatLocalDateValue(event.date, tz)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [visibleCalendarEvents, tz])

  const selectedDateKey = React.useMemo(
    () => (date ? getCalendarDateKey(date) : null),
    [date]
  )

  const dayEvents = React.useMemo(() => {
    if (!selectedDateKey) return [] as CalendarEventItem[]
    return visibleCalendarEvents
      .filter((event) => formatLocalDateValue(event.date, tz) === selectedDateKey)
      .sort((left, right) => {
        const byTime = left.date.getTime() - right.date.getTime()
        if (byTime !== 0) return byTime
        return getEventPriority(left.type) - getEventPriority(right.type)
      })
  }, [selectedDateKey, visibleCalendarEvents, tz])

  const leadById = React.useMemo(() => {
    return new Map(allLeads.map((lead) => [lead.id, lead] as const))
  }, [allLeads])

  const nowReference = React.useMemo(() => nowInTz(tz), [tz])

  const isMeetingOverdue = React.useCallback((lead: Lead, meetingDate: Date) => {
    return isMeetingFollowUpOverdue({
      status: lead.status,
      meetingDate,
      meetingHeald: lead.meetingHeald,
      now: nowReference,
    })
  }, [nowReference])

  const getMeetingStatuses = React.useCallback((lead: Lead, meetingDate: Date): CalendarMeetingStatusFilterValue[] => {
    const isCompleted = lead.meetingHeald === "yes"
    const isCanceled = lead.status === "no_show"
    const isOverdue = isMeetingOverdue(lead, meetingDate)
    const isScheduled = lead.status === "scheduled" && !isCompleted && !isOverdue

    const statuses: CalendarMeetingStatusFilterValue[] = []
    if (isScheduled) statuses.push("scheduled")
    if (isCompleted) statuses.push("completed")
    if (isCanceled) statuses.push("canceled")
    if (isOverdue) statuses.push("overdue")
    return statuses
  }, [isMeetingOverdue])

  const matchesPriority = React.useCallback((isUrgent: boolean, isOverdue: boolean) => {
    if (priorityFilter.length === 0) return true
    return (
      (priorityFilter.includes("urgent") && isUrgent)
      || (priorityFilter.includes("overdue") && isOverdue)
    )
  }, [priorityFilter])

  const filteredEvents = React.useMemo(() => {
    const query = leadSearchFilter.trim().toLowerCase()
    return dayEvents.filter((event) => {
      const lead = event.lead
      const eventDate = event.date
      const leadEmail = (lead.email || "").toLowerCase()
      const attendeeEmails = (attendeesByLead[lead.id]?.attendees || [])
        .map((attendee) => attendee.email.toLowerCase())
      const attendeeNames = (attendeesByLead[lead.id]?.attendees || [])
        .map((attendee) => (attendee.displayName || "").toLowerCase())
      const matchesTime = !selectedTime || isWithinSlot(eventDate, selectedTime, tz)
      const matchesSearch =
        !query
        || lead.name.toLowerCase().includes(query)
        || lead.leadCode.toLowerCase().includes(query)
        || lead.id.toLowerCase().includes(query)
        || leadEmail.includes(query)
        || attendeeEmails.some((email) => email.includes(query))
        || attendeeNames.some((name) => name.includes(query))
      const matchesCloser =
        closerFilter.length === 0 ||
        (lead.closerId ? closerFilter.includes(lead.closerId) : false)
      const matchesMeetingStatus =
        meetingStatusFilter.length === 0
          ? true
          : event.type === "meeting"
            ? getMeetingStatuses(lead, eventDate).some((status) => meetingStatusFilter.includes(status))
            : false
      const isUrgent = event.type === "lead_time"
      const isOverdue = event.type === "meeting"
        ? isMeetingOverdue(lead, eventDate)
        : eventDate.getTime() < nowReference.getTime()
      const priorityMatch = matchesPriority(isUrgent, isOverdue)
      return matchesTime && matchesSearch && matchesCloser && matchesMeetingStatus && priorityMatch
    })
  }, [
    dayEvents,
    leadSearchFilter,
    selectedTime,
    closerFilter,
    tz,
    attendeesByLead,
    isMeetingOverdue,
    nowReference,
    matchesPriority,
    meetingStatusFilter,
    getMeetingStatuses,
  ])

  const leadPickerCandidates = React.useMemo(() => {
    const query = leadPickerQuery.trim().toLowerCase()
    return allLeads
      .filter((lead) => lead.status !== "contract_finalized")
      .filter((lead) => {
        if (!query) return true
        return (
          lead.name.toLowerCase().includes(query) ||
          lead.leadCode.toLowerCase().includes(query)
        )
      })
  }, [allLeads, leadPickerQuery])

  const handleCancelSchedule = async () => {
    if (!leadToCancel) return
    try {
      if (!supabaseId || !activeTeamId) {
        throw new Error("Usuário ou time não identificado")
      }

      const transitionValidation = await leadStatusTransitionClient.validateStatusTransition({
        leadId: leadToCancel.id,
        targetStatus: "new_opportunity",
        supabaseId,
        teamId: activeTeamId,
      })

      if (!transitionValidation.transition.allowed || !transitionValidation.output.isValid) {
        throw new Error(
          transitionValidation.output.errorMessages?.join(", ") ||
            "Transição de status inválida para cancelar agenda."
        )
      }

      const response = await fetch(`${API_CLIENT_BASE}/leads/${leadToCancel.id}/schedule/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId,
        },
      })
      const result = await response.json()
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.join(", ") || "Erro ao cancelar agenda")
      }
      setCancelDialogOpen(false)
      setLeadToCancel(null)
      await refreshLeads()
      const successMessage =
        result?.successMessages?.[0] || "Agenda cancelada com sucesso"
      const warningMessage =
        result?.successMessages?.length > 1
          ? result.successMessages.slice(1).join(" ")
          : undefined
      toast.success(successMessage)
      if (warningMessage) {
        toast.info(warningMessage)
      }
    } catch (error) {
      console.error("Erro ao cancelar agenda:", error)
      const message = toUserToastMessage(error)
      toast.error(message)
    }
  }

  const handleMarkNoShow = React.useCallback(
    async (lead: Lead) => {
      if (!supabaseId || !activeTeamId) return
      try {
        const response = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-supabase-user-id": supabaseId,
            "x-team-id": activeTeamId,
          },
          body: JSON.stringify({ status: "no_show" }),
        })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.isValid) {
          throw new Error(result?.errorMessages?.join(", ") || "Erro ao marcar no-show.")
        }
        toast.success("Agenda marcada como no-show.")
        await refreshLeads()
      } catch (error) {
        toastUserError(error)
      }
    },
    [supabaseId, activeTeamId, refreshLeads]
  )

  const handleScheduleSuccess = React.useCallback(
    async (payload?: ScheduleMeetingSuccessPayload) => {
      if (payload) {
        patchLead?.(payload.leadId, {
          status: payload.status,
          meetingDate: payload.meetingDate,
          meetingTitle: payload.meetingTitle,
          meetingNotes: payload.meetingNotes,
          meetingLink: payload.meetingLink,
          closerId: payload.closerId,
          meetingPresenceConfirmed: false,
          meetingPresenceConfirmedAt: null,
        })
      }
      await refreshLeads()
    },
    [patchLead, refreshLeads]
  )

  const closerOptions = React.useMemo(
    () =>
      closers.map((closer) => ({
        value: closer.id,
        label: closer.name || closer.email || "Sem nome",
      })),
    [closers]
  )

  const sourceOptions = React.useMemo(
    () => [
      { value: "meetings", label: "Reuniões" },
      { value: "tasks", label: "Tarefas" },
    ],
    []
  )

  const priorityOptions = React.useMemo(
    () => [
      { value: "urgent", label: "Urgentes" },
      { value: "overdue", label: "Vencidas" },
    ],
    []
  )

  const meetingStatusOptions = React.useMemo(
    () => [
      { value: "scheduled", label: "Agendada" },
      { value: "completed", label: "Concluída" },
      { value: "canceled", label: "Cancelada" },
      { value: "overdue", label: "Vencida" },
    ],
    []
  )

  const showMeetings = sourceFilter.includes("meetings")
  const showTasks = sourceFilter.includes("tasks")

  React.useEffect(() => {
    if (!selectedTime) return
    const target = timeListRef.current?.querySelector(
      `[data-time="${selectedTime}"]`
    ) as HTMLElement | null
    if (target) {
      target.scrollIntoView({ block: "center" })
    }
  }, [selectedTime])

  // Chave estável: só muda quando o dia selecionado ou os IDs dos leads de reunião realmente mudam.
  // Isso evita múltiplos requests causados por re-renders do contexto que recriam o array dayEvents.
  const attendeesFetchKey = React.useMemo(() => {
    const meetingIds = dayEvents
      .filter((e) => e.type === "meeting")
      .map((e) => e.lead.id)
      .sort()
      .join(",")
    return `${selectedDateKey ?? "none"}|${meetingIds}`
  }, [selectedDateKey, dayEvents])

  React.useEffect(() => {
    const meetingEvents = dayEvents.filter((e) => e.type === "meeting")

    if (meetingEvents.length === 0 || !supabaseId || !activeTeamId) {
      setAttendeesByLead({})
      return
    }

    let cancelled = false
    setAttendeesLoading(true)

    Promise.all(
      meetingEvents.map(async ({ lead }) => {
        const fallbackEntry = {
          attendees: buildFallbackAttendees(lead),
          hasGoogleData: false,
        }

        try {
          // Passa emails do contexto como hints para o servidor pular o prisma.lead.findUnique
          const params = new URLSearchParams()
          if (lead.closer?.email) params.set("closerEmail", lead.closer.email)
          if (lead.assignee?.email) params.set("sdrEmail", lead.assignee.email)
          if (lead.email) params.set("leadEmail", lead.email)

          const res = await fetch(`${API_CLIENT_BASE}/leads/${lead.id}/schedule/attendees?${params}`, {
            headers: {
              "x-supabase-user-id": supabaseId,
              "x-team-id": activeTeamId,
            },
          })
          if (!res.ok) return [lead.id, fallbackEntry] as const

          const json = await res.json().catch(() => null)

          if (!json?.isValid || !json?.result) {
            return [lead.id, fallbackEntry] as const
          }

          const mergedAttendees = mergeAttendeesWithFallback(
            lead,
            json.result.attendees
          )

          return [
            lead.id,
            {
              attendees: mergedAttendees,
              hasGoogleData: Boolean(json.result.hasGoogleData),
            },
          ] as const
        } catch {
          return [lead.id, fallbackEntry] as const
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setAttendeesByLead(Object.fromEntries(entries))
      setAttendeesLoading(false)
    }).catch(() => {
      if (cancelled) return
      setAttendeesLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [attendeesFetchKey, supabaseId, activeTeamId])

  const refreshTasks = React.useCallback((cancelled = false) => {
    if (!selectedDateKey || !supabaseId || !activeTeamId) {
      setTasks([])
      return Promise.resolve()
    }
    const dateFrom = `${selectedDateKey}T00:00:00.000Z`
    const dateTo = `${selectedDateKey}T23:59:59.999Z`
    const url = `${API_CLIENT_BASE}/tasks?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`

    return fetch(url, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId,
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setTasks(Array.isArray(json?.result) ? json.result : [])
        setTasksLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setTasksLoading(false)
      })
  }, [selectedDateKey, supabaseId, activeTeamId])

  const visibleTasks = React.useMemo(() => {
    if (!isRestrictedToOwnEvents || !user?.id) return tasks
    return tasks.filter((t) => t.assignees.some((a) => a.profile.id === user.id))
  }, [tasks, isRestrictedToOwnEvents, user?.id])

  const filteredTasks = React.useMemo(() => {
    const query = leadSearchFilter.trim().toLowerCase()
    return visibleTasks.filter((task) => {
      const relatedLead = leadById.get(task.leadId)
      const leadEmail = (relatedLead?.email || "").toLowerCase()
      const assigneeEmails = task.assignees.map((assignee) => assignee.profile.email.toLowerCase())

      const matchesSearch =
        !query
        || task.lead.name.toLowerCase().includes(query)
        || task.lead.leadCode.toLowerCase().includes(query)
        || task.leadId.toLowerCase().includes(query)
        || leadEmail.includes(query)
        || assigneeEmails.some((email) => email.includes(query))

      const matchesCloser =
        closerFilter.length === 0
        || (!!relatedLead?.closerId && closerFilter.includes(relatedLead.closerId))

      const taskEndAt = task.endAt ? new Date(task.endAt) : null
      const isOverdue =
        task.assignees.some((assignee) => assignee.status === "OVERDUE")
        || (!!taskEndAt && taskEndAt.getTime() < nowReference.getTime())
      const isUrgent = task.isUrgent
      const priorityMatch = matchesPriority(isUrgent, isOverdue)

      return matchesSearch && matchesCloser && priorityMatch
    })
  }, [visibleTasks, leadSearchFilter, leadById, closerFilter, nowReference, matchesPriority])

  const refreshTaskDayCounts = React.useCallback((cancelled = false) => {
    if (!supabaseId || !activeTeamId) {
      setMonthTasks([])
      return Promise.resolve()
    }

    const monthStart = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth(), 1, 0, 0, 0, 0))
    const monthEnd = new Date(Date.UTC(calendarMonth.getUTCFullYear(), calendarMonth.getUTCMonth() + 1, 0, 23, 59, 59, 999))
    const url = `${API_CLIENT_BASE}/tasks?dateFrom=${encodeURIComponent(monthStart.toISOString())}&dateTo=${encodeURIComponent(monthEnd.toISOString())}`

    return fetch(url, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": activeTeamId,
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setMonthTasks(Array.isArray(json?.result) ? (json.result as TaskItem[]) : [])
      })
      .catch(() => {
        if (cancelled) return
        setMonthTasks([])
      })
  }, [supabaseId, activeTeamId, calendarMonth])

  const taskDayCounts = React.useMemo(() => {
    const filtered = isRestrictedToOwnEvents && user?.id
      ? monthTasks.filter((t) => t.assignees.some((a) => a.profile.id === user.id))
      : monthTasks
    const counts = new Map<string, number>()
    filtered.forEach((task) => {
      const rawDate = task.startAt || task.endAt || task.createdAt
      if (!rawDate) return
      const parsedDate = new Date(rawDate)
      if (Number.isNaN(parsedDate.getTime())) return
      const key = formatLocalDateValue(parsedDate, tz)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [monthTasks, isRestrictedToOwnEvents, user?.id, tz])

  // Fetch tasks for the selected date range (full day)
  React.useEffect(() => {
    let cancelled = false
    setTasksLoading(true)
    void refreshTasks(cancelled)
    return () => {
      cancelled = true
    }
  }, [refreshTasks])

  React.useEffect(() => {
    let cancelled = false
    void refreshTaskDayCounts(cancelled)
    return () => {
      cancelled = true
    }
  }, [refreshTaskDayCounts])

  return (
    <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
      <div className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:h-full">
        <Card className="w-full min-h-0 lg:h-full">
          <CardContent className="flex h-full min-h-0 flex-col gap-4 py-4 px-2">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(nextDate) => {
                setDate(nextDate)
                if (nextDate) onCalendarMonthChange(nextDate)
              }}
              month={calendarMonth}
              onMonthChange={onCalendarMonthChange}
              defaultMonth={date}
              locale={ptBR}
              showOutsideDays={false}
              weekdayLabelFormat="short"
              className="bg-transparent p-0 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
              modifiers={{
                past: (day) => getCalendarDateKey(day) < todayKey,
              }}
              modifiersClassNames={{
                past: "opacity-50 line-through",
              }}
              components={{
                DayButton: (props) => {
                  const key = getCalendarDateKey(props.day.date)
                  const scheduleCount = dayEventCounts.get(key) ?? 0
                  const tasksCount = taskDayCounts.get(key) ?? 0
                  const count = scheduleCount + tasksCount
                  const isSelected = selectedDateKey === key
                  return (
                    <CalendarDayButton
                      {...props}
                      className={cn(props.className, count > 0 && "gap-0.5")}
                    >
                      <span>{props.children}</span>
                      {count > 0 && (
                        <span className={cn(
                          "text-[9px] font-semibold leading-none",
                          isSelected ? "text-primary-foreground/75" : "text-primary"
                        )}>
                          {count}
                        </span>
                      )}
                    </CalendarDayButton>
                  )
                },
              }}
              formatters={{
                formatMonthCaption: (value) => {
                  const raw = formatIntimezone(value, "MMM", tz)
                  const month = raw.endsWith(".") ? raw : `${raw}.`
                  return `${month} ${formatIntimezone(value, "yyyy", tz)}`
                },
              }}
            />
            <div className="flex items-center justify-between px-2">
              <div className="text-xs font-medium text-muted-foreground">Horários</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTime(null)}
                disabled={!selectedTime}
              >
                Limpar horário
              </Button>
            </div>
            <div
              ref={timeListRef}
              className="no-scrollbar flex max-h-[40dvh] flex-col gap-2 overflow-y-auto px-2 lg:max-h-none lg:min-h-0 lg:flex-1"
            >
              {ALL_TIME_SLOTS.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "default" : "outline"}
                  onClick={() => setSelectedTime(time)}
                  className="w-full shadow-none"
                  data-time={time}
                >
                  {time}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full w-full min-h-0">
          <CardContent className="flex h-full min-h-0 w-full flex-col gap-4 p-4">
            <LeadsFiltersLayout
              actions={
                <Button onClick={() => setLeadPickerOpen(true)} className="group shrink-0">
                  <CirclePlus
                    className="mr-2 transition-transform duration-300 group-hover:rotate-90"
                    size={16}
                  />
                  Agendar Reunião
                </Button>
              }
            >
              <Input
                id="lead-search-filter"
                value={leadSearchFilter}
                onChange={(event) => setLeadSearchFilter(event.target.value)}
                placeholder="Nome, ID, código ou e-mail..."
                className="h-8 w-full max-w-none lg:w-[420px]"
              />
            </LeadsFiltersLayout>

            <LeadsFiltersLayout>
              {closerOptions.length > 0 && (
                <LeadsMultiFilter
                  title="Closer"
                  options={closerOptions}
                  selectedValues={closerFilter}
                  onChange={setCloserFilter}
                />
              )}
              <LeadsMultiFilter
                title="Tipo"
                options={sourceOptions}
                selectedValues={sourceFilter}
                onChange={(values) => {
                  const typedValues = values.filter(
                    (value): value is CalendarSourceFilterValue => value === "meetings" || value === "tasks"
                  )
                  if (typedValues.length === 0) {
                    setSourceFilter(["meetings", "tasks"])
                    return
                  }
                  setSourceFilter(typedValues)
                }}
              />
              <LeadsMultiFilter
                title="Prioridade"
                options={priorityOptions}
                selectedValues={priorityFilter}
                onChange={(values) =>
                  setPriorityFilter(
                    values.filter(
                      (value): value is CalendarPriorityFilterValue => value === "urgent" || value === "overdue"
                    )
                  )
                }
              />
              <LeadsMultiFilter
                title="Status reunião"
                options={meetingStatusOptions}
                selectedValues={meetingStatusFilter}
                onChange={(values) =>
                  setMeetingStatusFilter(
                    values.filter(
                      (value): value is CalendarMeetingStatusFilterValue =>
                        value === "scheduled" || value === "completed" || value === "canceled" || value === "overdue"
                    )
                  )
                }
              />
            </LeadsFiltersLayout>

            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-sm font-medium">
                    {selectedDateKey
                      ? formatIntimezone(
                          parseDateKeyToUtc(selectedDateKey, tz),
                          "EEEE, dd 'de' MMMM 'de' yyyy",
                          tz
                        )
                      : "Selecione um dia"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedTime ? `Horário: ${selectedTime}` : "Sem horário selecionado"}
                  </div>
                </div>
              </div>
            </div>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {isLoading || tasksLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-28 w-full rounded-md" />
                ))
              ) : (showMeetings ? filteredEvents.length : 0) === 0 && (showTasks ? filteredTasks.length : 0) === 0 ? (
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma agenda, tarefa ou lembrete para este dia e horário.
                  </p>
                  <Button onClick={() => setLeadPickerOpen(true)}>Agendar nova reunião</Button>
                </div>
              ) : (
                <>
                {showTasks && filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentProfileId={user?.id ?? ""}
                    supabaseId={supabaseId ?? ""}
                    activeTeamId={activeTeamId ?? ""}
                    tz={tz}
                    onStatusUpdated={() => {
                      void refreshTasks()
                      void refreshTaskDayCounts()
                    }}
                    onCanceled={() => {
                      setTasks((prev) => prev.filter((t) => t.id !== task.id))
                      void refreshTaskDayCounts()
                    }}
                    onEdit={(selectedTask) => {
                      const leadFromTask = allLeads.find((lead) => lead.id === selectedTask.leadId)
                      if (!leadFromTask) {
                        toast.error("Lead da tarefa não encontrado.")
                        return
                      }
                      setEditingTask(selectedTask)
                      setTaskDialogLead(leadFromTask)
                      setTaskDialogOpen(true)
                    }}
                    onCardClick={(selectedTask) => {
                      const leadFromTask = allLeads.find((lead) => lead.id === selectedTask.leadId)
                      if (!leadFromTask) {
                        toast.error("Lead da tarefa não encontrado.")
                        return
                      }
                      handleCardClick(leadFromTask)
                      setEditingTask(selectedTask)
                      setTaskDialogLead(leadFromTask)
                      setTaskDialogOpen(true)
                    }}
                  />
                ))}
                {showMeetings && filteredEvents.map((event) => {
                  const lead = event.lead
                  const closerLabel = getCloserLabel(lead, closersById)
                  const isMeeting = event.type === "meeting"
                  const isFutureSale = event.type === "future_sale"
                  const isLeadTimeReminder = event.type === "lead_time"

                  const meetingStart = isMeeting ? event.date : null
                  const meetingEnd = meetingStart
                    ? new Date(meetingStart.getTime() + 30 * 60 * 1000)
                    : null
                  const meetingTitle = lead.meetingTitle || `Estudo Plano de Saúde: ${lead.name}`
                  const isCanceled = isMeeting && lead.status === "no_show"
                  const isOverdue =
                    isMeeting &&
                    !!meetingStart &&
                    isMeetingFollowUpOverdue({
                      status: lead.status,
                      meetingDate: meetingStart,
                      meetingHeald: lead.meetingHeald,
                    })
                  const isPresenceConfirmed = lead.meetingPresenceConfirmed === true
                  const isPresenceConfirmationDue =
                    isMeeting &&
                    !lead.isTransfer &&
                    isMeetingPresenceConfirmationDue({
                      status: lead.status,
                      meetingDate: meetingStart,
                      meetingPresenceConfirmed: lead.meetingPresenceConfirmed,
                      isTransfer: lead.isTransfer,
                    })
                  const canConfirmPresence =
                    isMeeting && !lead.isTransfer && canConfirmPresenceForLead(lead)

                  if (isMeeting) {
                    const entry = attendeesByLead[lead.id]
                    return (
                      <Card
                        key={`${event.type}:${lead.id}:${event.date.toISOString()}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (suppressLeadDialogOpen) return
                          handleCardClick(lead)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            if (suppressLeadDialogOpen) return
                            handleCardClick(lead)
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-primary/35 bg-primary/5 shadow-none",
                          isCanceled && "opacity-70",
                          isOverdue && "border-destructive/70 ring-1 ring-destructive/40",
                          !isOverdue &&
                            isPresenceConfirmationDue &&
                            "border-semantic-warning/70 ring-1 ring-semantic-warning/40"
                        )}
                      >
                        <CardContent className="flex flex-col gap-3 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <CalendarIcon className="size-4 text-muted-foreground" />
                              <p className={cn("text-sm font-semibold", isCanceled && "line-through")}>{meetingTitle}</p>
                              {isPresenceConfirmed ? (
                                <Badge
                                  variant="outline"
                                  className={cn(getMeetingPresenceBadgeClass("confirmed"))}
                                >
                                  <BadgeCheck className="size-3" />
                                  {getMeetingPresenceBadgeLabel("confirmed")}
                                </Badge>
                              ) : isPresenceConfirmationDue ? (
                                <Badge
                                  variant="outline"
                                  className={cn(getMeetingPresenceBadgeClass("pending"))}
                                >
                                  {getMeetingPresenceAlertLabel()}
                                </Badge>
                              ) : null}
                              {isOverdue && <Badge variant="default">Confirme a reunião</Badge>}
                              {isCanceled && (
                                <Badge className="border-semantic-danger-border bg-transparent text-semantic-danger hover:bg-transparent">
                                  Reunião cancelada
                                </Badge>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  data-no-card-open="true"
                                  className="size-7 shrink-0"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreVertical className="size-4" />
                                  <span className="sr-only">Ações do agendamento</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    blockLeadDialogOpen()
                                    setLeadToSchedule(lead)
                                    setScheduleDialogMode("reschedule")
                                    setScheduleDialogOpen(true)
                                  }}
                                >
                                  Editar agendamento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    blockLeadDialogOpen()
                                    setLeadToSchedule(lead)
                                    setScheduleDialogMode("reschedule")
                                    setScheduleDialogOpen(true)
                                  }}
                                >
                                  Reagendar reunião
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={!isOverdue} onSelect={() => { void handleMarkNoShow(lead) }}>
                                  No-show
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => {
                                    blockLeadDialogOpen()
                                    setOpen(false)
                                    setLeadToCancel(lead)
                                    setCancelDialogOpen(true)
                                  }}
                                >
                                  Cancelar agenda
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="text-xs text-muted-foreground">Lead: {lead.name} <span className="opacity-60">· {lead.leadCode}</span></div>
                          <div className={cn("text-xs text-muted-foreground", isCanceled && "line-through")}>
                            {meetingStart && meetingEnd
                              ? formatDateRange(meetingStart, meetingEnd, tz)
                              : formatIntimezone(event.date, "dd/MM/yyyy HH:mm", tz)}
                          </div>
                          <div className={cn("text-xs text-muted-foreground", isCanceled && "line-through")}>Closer: {closerLabel}</div>
                          <p className="text-sm text-muted-foreground">{lead.meetingNotes || `Reunião agendada com ${lead.name}`}</p>

                          <Separator />

                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                              <span className="text-xs font-medium text-muted-foreground">Convites</span>
                              {attendeesLoading && entry === undefined ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-20 rounded-full" />)}
                                </div>
                              ) : entry?.attendees?.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {entry.attendees.map((a) => {
                                    const Icon = RSVP_ICON[a.responseStatus]
                                    return (
                                      <span
                                        key={a.email}
                                        title={a.email}
                                        className={cn(
                                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
                                          RSVP_COLOR[a.responseStatus]
                                        )}
                                      >
                                        <Icon className="size-3 shrink-0" />
                                        <span className="opacity-60">{ROLE_LABEL[a.role]}</span>
                                        <span>{a.displayName ?? a.email.split("@")[0]}</span>
                                        <span className="opacity-40">·</span>
                                        <span>{RSVP_LABEL[a.responseStatus]}</span>
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                              {canConfirmPresence && !isPresenceConfirmed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-no-card-open="true"
                                  disabled={meetingPresenceConfirmSavingId === lead.id}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleConfirmMeetingPresence(lead)
                                  }}
                                >
                                  {meetingPresenceConfirmSavingId === lead.id ? (
                                    <>
                                      <Loader2 className="size-4 animate-spin" />
                                      Confirmando...
                                    </>
                                  ) : (
                                    <>
                                      <BadgeCheck className="size-4" />
                                      Confirmar agenda
                                    </>
                                  )}
                                </Button>
                              )}
                            {lead.status === "scheduled" && canToggleMeetingHeald && (
                              <Button
                                size="sm"
                                variant={lead.meetingHeald === "yes" ? "default" : "outline"}
                                data-no-card-open="true"
                                disabled={meetingHealdSavingId === lead.id || !canToggleMeetingHeald}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleToggleMeetingHeald(lead, lead.meetingHeald !== "yes")
                                }}
                              >
                                {meetingHealdSavingId === lead.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Salvando...
                                  </>
                                ) : lead.meetingHeald === "yes" ? (
                                  <>
                                    <BadgeCheck className="h-4 w-4" />
                                    Reunião realizada
                                  </>
                                ) : (
                                  <>
                                    <BadgeIcon className="h-4 w-4" />
                                    Reunião realizada
                                  </>
                                )}
                              </Button>
                            )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }

                  return (
                    <div
                      key={`${event.type}:${lead.id}:${event.date.toISOString()}`}
                      className={cn(
                        "bg-muted hover:bg-muted/80 after:bg-primary/70 relative rounded-md p-3 pl-6 text-left text-sm transition-colors after:absolute after:inset-y-3 after:left-3 after:w-1 after:rounded-full",
                        isFutureSale && "after:bg-semantic-warning/80",
                        isLeadTimeReminder && "after:bg-semantic-danger/80"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleCardClick(lead)}
                        className="flex w-full flex-col gap-1 text-left"
                      >
                        <div className="font-medium">
                          {isFutureSale ? `Lead a vencer: ${lead.name}` : `Lead time vencido: ${lead.name}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatIntimezone(event.date, "dd/MM/yyyy HH:mm", tz)}
                        </div>
                        {isFutureSale ? (
                          <>
                            <div className="text-xs text-muted-foreground">Entrar em contato com o cliente referente ao lead.</div>
                            <div className="text-xs text-muted-foreground">Comentários: {lead.followUpNotes?.trim() || "Sem comentários."}</div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Este lead ultrapassou o tempo máximo configurado para o status <strong>{getStatusLabel(lead.status)}</strong>.
                          </div>
                        )}
                      </button>
                    </div>
                  )
                })}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <LeadDialog
        open={open && !cancelDialogOpen}
        setOpen={setOpen}
        lead={selected}
        user={user}
        userLoading={userLoading}
        refreshLeads={refreshLeads}
        finalizeContract={finalizeContract}
        patchLead={patchLead}
      />

      <Dialog open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle>Selecionar lead</DialogTitle>
            <DialogDescription>Agendar reunião ou criar tarefa</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={leadPickerQuery}
              onChange={(event) => setLeadPickerQuery(event.target.value)}
              placeholder="Buscar por nome ou ID"
            />
            <div className="max-h-90 overflow-y-auto rounded-md border">
              {leadPickerCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Nenhum lead encontrado.</div>
              ) : (
                leadPickerCandidates.map((lead) => {
                  const closerLabel = getCloserLabel(lead, closersById)
                  return (
                    <div
                      key={lead.id}
                      className="flex w-full items-center justify-between gap-3 border-b px-4 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {lead.leadCode} • Closer: {closerLabel}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLeadToSchedule(lead)
                            setScheduleDialogMode("create")
                            setLeadPickerOpen(false)
                            setScheduleDialogOpen(true)
                          }}
                        >
                          Reunião
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTask(null)
                            setTaskDialogLead(lead)
                            setLeadPickerOpen(false)
                            setTaskDialogOpen(true)
                          }}
                        >
                          Tarefa
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {leadToSchedule && (
        <ScheduleMeetingDialog
          open={scheduleDialogOpen}
          onOpenChange={(nextOpen) => {
            setScheduleDialogOpen(nextOpen)
            if (!nextOpen) {
              setLeadToSchedule(null)
              setScheduleDialogMode("create")
            }
          }}
          lead={leadToSchedule}
          onScheduleSuccess={handleScheduleSuccess}
          closers={closers}
          teamMembers={user?.usersAssociated ?? []}
          mode={scheduleDialogMode}
        />
      )}

      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(nextOpen) => {
          setCancelDialogOpen(nextOpen)
          if (!nextOpen) {
            setLeadToCancel(null)
          }
        }}
      >
        <DialogContent className="z-[80] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Cancelar agenda</DialogTitle>
            <DialogDescription>
              Deseja cancelar a agenda atual ou reagendar a reunião? Ao confirmar o cancelamento, o card será atualizado para o status de Nova oportunidade.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!leadToCancel) return
                setCancelDialogOpen(false)
                setLeadToSchedule(leadToCancel)
                setScheduleDialogMode("reschedule")
                setScheduleDialogOpen(true)
              }}
            >
              Reagendar
            </Button>
            <Button variant="destructive" onClick={handleCancelSchedule}>
              Cancelar agenda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {taskDialogLead && supabaseId && activeTeamId && (
        <TaskFormDialog
          open={taskDialogOpen}
          onOpenChange={(next) => {
            setTaskDialogOpen(next)
            if (!next) {
              setTaskDialogLead(null)
              setEditingTask(null)
            }
          }}
          leadId={taskDialogLead.id}
          leadName={taskDialogLead.name}
          teamMembers={user?.usersAssociated ?? []}
          supabaseId={supabaseId}
          activeTeamId={activeTeamId}
          initialData={editingTask ? {
            taskId: editingTask.id,
            title: editingTask.title,
            taskType: editingTask.taskType,
            body: editingTask.body,
            isUrgent: editingTask.isUrgent,
            startAt: editingTask.startAt,
            endAt: editingTask.endAt,
            assigneeProfileIds: editingTask.assignees.map((a) => a.profileId),
          } : null}
          onSuccess={(_payload: TaskCreatedPayload) => {
            void refreshTasks()
            void refreshTaskDayCounts()
          }}
        />
      )}
    </div>
  )
}
