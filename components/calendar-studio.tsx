"use client"

import * as React from "react"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CirclePlus } from "@/components/animate-ui/icons/circle-plus"
import { CheckCircle2, XCircle, HelpCircle, Clock } from "lucide-react"
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog"
import useBoardContext from "@/app/[supabaseId]/board/features/context/BoardHook"
import {
  ScheduleMeetingDialog,
  type ScheduleMeetingSuccessPayload,
} from "@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog"
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes"
import { getLeadStatusLabel } from "@/lib/lead-status"
import { CalendarDayButton } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useTeamContext } from "@/app/context/TeamContext"
import { Checkbox } from "@/components/ui/checkbox"

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
  accepted: "border-green-500 bg-green-500/10 text-green-600",
  declined: "border-red-500 bg-red-500/10 text-red-600",
  tentative: "border-yellow-500 bg-yellow-500/10 text-yellow-600",
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

const getNextSlotTime = () => {
  const now = new Date()
  const totalMinutes = now.getHours() * 60 + now.getMinutes()
  const rounded = Math.ceil(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES
  const clamped = Math.min(rounded, 24 * 60 - SLOT_MINUTES)
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map((part) => Number(part))
  return hours * 60 + minutes
}

const dateToMinutes = (date: Date) =>
  date.getHours() * 60 +
  date.getMinutes() +
  date.getSeconds() / 60 +
  date.getMilliseconds() / 60000

const getSlotIndex = (minutes: number) => Math.floor(minutes / SLOT_MINUTES)

const isWithinSlot = (meetingDate: Date, slotStart: string) => {
  const startMinutes = timeToMinutes(slotStart)
  const meetingMinutes = dateToMinutes(meetingDate)
  return getSlotIndex(meetingMinutes) === getSlotIndex(startMinutes)
}

const formatDateRange = (from: Date, to: Date) => {
  const day = from.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  return `${day} ${formatTime(from)} - ${formatTime(to)}`
}

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const getCloserLabel = (lead: Lead, closersById: Map<string, string>) =>
  lead.closer?.fullName ||
  lead.closer?.email ||
  (lead.closerId ? closersById.get(lead.closerId) : undefined) ||
  "Sem closer"

const getInitials = (name?: string | null) => {
  const safeName = name?.trim() || ""
  if (!safeName) return "CS"
  const words = safeName.split(" ").filter(Boolean)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return `${words[0].charAt(0)}${words[words.length - 1].charAt(0)}`.toUpperCase()
}

const getStatusLabel = (status: Lead["status"]) => getLeadStatusLabel(status)

type CalendarEventType = "meeting" | "future_sale" | "lead_time"

type CalendarEventItem = {
  type: CalendarEventType
  lead: Lead
  date: Date
}

const getEventPriority = (type: CalendarEventType) => {
  if (type === "meeting") return 0
  if (type === "future_sale") return 1
  return 2
}

export default function CalendarStudio() {
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
  const [selectedTime, setSelectedTime] = React.useState<string | null>(getNextSlotTime())
  const [leadNameFilter, setLeadNameFilter] = React.useState("")
  const [leadIdFilter, setLeadIdFilter] = React.useState("")
  const [closerFilter, setCloserFilter] = React.useState<string[]>([])
  const [leadPickerOpen, setLeadPickerOpen] = React.useState(false)
  const [leadToSchedule, setLeadToSchedule] = React.useState<Lead | null>(null)
  const [scheduleDialogMode, setScheduleDialogMode] = React.useState<"create" | "reschedule">("create")
  const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false)
  const [leadPickerQuery, setLeadPickerQuery] = React.useState("")
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [leadToCancel, setLeadToCancel] = React.useState<Lead | null>(null)
  const [meetingHealdSavingId, setMeetingHealdSavingId] = React.useState<string | null>(null)
  const [attendeesByLead, setAttendeesByLead] = React.useState<AttendeesByLead>({})
  const [attendeesLoading, setAttendeesLoading] = React.useState(false)
  const params = useParams()
  const supabaseId = params.supabaseId as string | undefined
  const { activeTeamId, activeFunctions, isTeamMaster } = useTeamContext()
  const timeListRef = React.useRef<HTMLDivElement | null>(null)

  const canToggleMeetingHeald = React.useMemo(() => {
    return isTeamMaster || activeFunctions.includes("CLOSER")
  }, [isTeamMaster, activeFunctions])

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
        const response = await fetch(`/api/v1/leads/${lead.id}`, {
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
          throw new Error(result?.errorMessages?.join(", ") || "Nao foi possivel atualizar a reuniao.")
        }

        const serverValue = result?.result?.meetingHeald ?? next
        patchLead?.(lead.id, { meetingHeald: serverValue })
      } catch (err) {
        patchLead?.(lead.id, { meetingHeald: previous })
        toast.warning(
          err instanceof Error ? err.message : "Nao foi possivel atualizar a reuniao.",
        )
      } finally {
        setMeetingHealdSavingId(null)
      }
    },
    [supabaseId, activeTeamId, canToggleMeetingHeald, patchLead],
  )

  const todayStart = React.useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

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

  const dayEventCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    calendarEvents.forEach((event) => {
      const key = toDateKey(event.date)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [calendarEvents])

  const dayEvents = React.useMemo(() => {
    if (!date) return [] as CalendarEventItem[]
    return calendarEvents
      .filter((event) => isSameDay(date, event.date))
      .sort((left, right) => {
        const byTime = left.date.getTime() - right.date.getTime()
        if (byTime !== 0) return byTime
        return getEventPriority(left.type) - getEventPriority(right.type)
      })
  }, [date, calendarEvents])

  const filteredEvents = React.useMemo(() => {
    const nameQuery = leadNameFilter.trim().toLowerCase()
    const idQuery = leadIdFilter.trim().toLowerCase()
    return dayEvents.filter((event) => {
      const lead = event.lead
      const eventDate = event.date
      const matchesTime = !selectedTime || isWithinSlot(eventDate, selectedTime)
      const matchesName =
        !nameQuery || lead.name.toLowerCase().includes(nameQuery)
      const matchesId =
        !idQuery ||
        lead.leadCode.toLowerCase().includes(idQuery) ||
        lead.id.toLowerCase().includes(idQuery)
      const matchesCloser =
        closerFilter.length === 0 ||
        (lead.closerId ? closerFilter.includes(lead.closerId) : false)
      return matchesTime && matchesName && matchesId && matchesCloser
    })
  }, [dayEvents, leadNameFilter, leadIdFilter, selectedTime, closerFilter])

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
      if (!supabaseId) {
        throw new Error("Usuario nao identificado")
      }
      const response = await fetch(`/api/v1/leads/${leadToCancel.id}/schedule/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
          "x-team-id": activeTeamId || "",
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
      const message = error instanceof Error ? error.message : "Erro ao cancelar agenda"
      toast.error(message)
    }
  }

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
        })
      }
      await refreshLeads()
    },
    [patchLead, refreshLeads]
  )

  const selectedClosers = closers.filter((closer) =>
    closerFilter.includes(closer.id)
  )

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
    const dateKey = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : "none"
    return `${dateKey}|${meetingIds}`
  }, [date, dayEvents])

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

          const res = await fetch(`/api/v1/leads/${lead.id}/schedule/attendees?${params}`, {
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

  return (
    <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
      <div className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:h-full">
        <Card className="w-full min-h-0 lg:h-full">
          <CardContent className="flex h-full min-h-0 flex-col gap-4 py-4 px-2">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              defaultMonth={date}
              locale={ptBR}
              showOutsideDays={false}
              className="bg-transparent p-0 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
              modifiers={{
                past: (day) => day < todayStart,
              }}
              modifiersClassNames={{
                past: "opacity-50 line-through",
              }}
              components={{
                DayButton: (props) => {
                  const count = dayEventCounts.get(toDateKey(props.day.date)) ?? 0
                  return (
                    <CalendarDayButton
                      {...props}
                      className={cn(props.className, count > 0 && "gap-0.5")}
                    >
                      <span>{props.children}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {count > 0 ? count : ""}
                      </span>
                    </CalendarDayButton>
                  )
                },
              }}
              formatters={{
                formatMonthCaption: (value) => {
                  const raw = value.toLocaleString("pt-BR", { month: "short" })
                  const month = raw.endsWith(".") ? raw : `${raw}.`
                  return `${month} ${value.getFullYear()}`
                },
                formatWeekdayName: (value) => {
                  return value.toLocaleString("pt-BR", { weekday: "short" })
                },
              }}
            />
            <div className="flex items-center justify-between px-2">
              <div className="text-xs font-medium text-muted-foreground">Horarios</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTime(null)}
                disabled={!selectedTime}
              >
                Limpar horario
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
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="w-full min-w-0">
                <Label htmlFor="lead-name-filter" className="text-xs">
                  Nome do lead
                </Label>
                <Input
                  id="lead-name-filter"
                  value={leadNameFilter}
                  onChange={(event) => setLeadNameFilter(event.target.value)}
                  placeholder="Filtrar por nome"
                  className="w-full max-w-none"
                />
              </div>
              <div className="w-full min-w-0">
                <Label htmlFor="lead-id-filter" className="text-xs">
                  ID do lead
                </Label>
                <Input
                  id="lead-id-filter"
                  value={leadIdFilter}
                  onChange={(event) => setLeadIdFilter(event.target.value)}
                  placeholder="ID ou codigo"
                  className="w-full max-w-none"
                />
              </div>
              <div className="w-full min-w-0">
                <Label className="text-xs">Closer</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between gap-2 px-3">
                      {selectedClosers.length === 0 && (
                        <span className="text-muted-foreground">Todos</span>
                      )}
                      {selectedClosers.length === 1 && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={selectedClosers[0].avatarImageUrl} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(selectedClosers[0].name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{selectedClosers[0].name}</span>
                        </div>
                      )}
                      {selectedClosers.length > 1 && <span>{selectedClosers.length} closers</span>}
                      <span className="ml-auto text-muted-foreground">▼</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuCheckboxItem
                      checked={closerFilter.length === 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCloserFilter([])
                        }
                      }}
                    >
                      Todos
                    </DropdownMenuCheckboxItem>
                    {closers.map((closer) => {
                      const checked = closerFilter.includes(closer.id)
                      return (
                        <DropdownMenuCheckboxItem
                          key={closer.id}
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            setCloserFilter((prev) => {
                              if (nextChecked) {
                                return prev.includes(closer.id) ? prev : [...prev, closer.id]
                              }
                              return prev.filter((id) => id !== closer.id)
                            })
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={closer.avatarImageUrl} />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(closer.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{closer.name}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {date
                    ? date.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "Selecione um dia"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedTime ? `Horario: ${selectedTime}` : "Sem horario selecionado"}
                </div>
              </div>
              <Button variant="outline" onClick={() => setLeadPickerOpen(true)} className="group">
                <CirclePlus
                  className="mr-2 transition-transform duration-300 group-hover:rotate-90"
                  size={16}
                />
                Agendar Reunião
              </Button>
            </div>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-28 w-full rounded-md" />
                ))
              ) : filteredEvents.length === 0 ? (
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma agenda ou lembrete para este dia e horário.
                  </p>
                  <Button onClick={() => setLeadPickerOpen(true)}>Agendar nova reunião</Button>
                </div>
              ) : (
                filteredEvents.map((event) => {
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
                  const showLeadName = meetingTitle !== lead.name
                  const isCanceled = isMeeting && lead.status === "no_show"
                  const isOverdue =
                    isMeeting &&
                    !!meetingStart &&
                    meetingStart.getTime() < Date.now() &&
                    lead.status === "scheduled" &&
                    lead.meetingHeald !== "yes"

                  return (
                    <div
                      key={`${event.type}:${lead.id}:${event.date.toISOString()}`}
                      className={cn(
                        "bg-muted hover:bg-muted/80 after:bg-primary/70 relative rounded-md p-3 pl-6 text-left text-sm transition-colors after:absolute after:inset-y-3 after:left-3 after:w-1 after:rounded-full",
                        isCanceled && "opacity-70",
                        isFutureSale && "after:bg-orange-500/80",
                        isLeadTimeReminder && "after:bg-red-500/80 animate-pulse"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleCardClick(lead)}
                        className="flex w-full flex-col gap-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={cn("font-medium", isCanceled && "line-through")}>
                              {isMeeting
                                ? meetingTitle
                                : isFutureSale
                                ? `Lead a vencer: ${lead.name}`
                                : `Lead time vencido: ${lead.name}`}
                            </div>
                            {isMeeting && isOverdue && <Badge variant="default">Reunião vencida</Badge>}
                            {isMeeting && isCanceled && (
                              <Badge className="border-red-500 bg-transparent text-red-500 hover:bg-transparent">
                                Reunião cancelada
                              </Badge>
                            )}
                            {isFutureSale && (
                              <Badge className="border-orange-500 bg-orange-500/15 text-orange-600 hover:bg-orange-500/15">
                                Lead a vencer
                              </Badge>
                            )}
                            {isLeadTimeReminder && (
                              <Badge className="border-red-500 bg-red-500/15 text-red-600 hover:bg-red-500/15">
                                Lead time vencido
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{lead.leadCode}</span>
                        </div>

                        {isMeeting && showLeadName && (
                          <div className="text-xs text-muted-foreground">Lead: {lead.name}</div>
                        )}

                        <div className={cn("text-xs text-muted-foreground", isCanceled && "line-through")}>
                          {isMeeting && meetingStart && meetingEnd
                            ? formatDateRange(meetingStart, meetingEnd)
                            : event.date.toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                        </div>
                        <div className={cn("text-xs text-muted-foreground", isCanceled && "line-through")}>
                          Closer: {closerLabel}
                        </div>

                        {isMeeting && lead.meetingNotes && (
                          <div className="text-xs text-muted-foreground">
                            Observações: {lead.meetingNotes}
                          </div>
                        )}

                        {isMeeting && (() => {
                          const entry = attendeesByLead[lead.id]
                          if (attendeesLoading && entry === undefined) {
                            return (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {[1, 2, 3].map((i) => (
                                  <Skeleton key={i} className="h-5 w-20 rounded-full" />
                                ))}
                              </div>
                            )
                          }
                          if (!entry || !entry.attendees || entry.attendees.length === 0) return null
                          return (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {!entry.hasGoogleData && (
                                <span className="text-[10px] text-muted-foreground italic">
                                  Confirmações indisponíveis (envio por e-mail)
                                </span>
                              )}
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
                            </div>
                          )
                        })()}

                        {isFutureSale && (
                          <>
                            <div className="text-xs text-muted-foreground">
                              Entrar em contato com o cliente referente ao lead.
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Comentários: {lead.followUpNotes?.trim() || "Sem comentários."}
                            </div>
                          </>
                        )}

                        {isLeadTimeReminder && (
                          <div className="text-xs text-muted-foreground">
                            Este lead ultrapassou o tempo máximo configurado para o status{" "}
                            <strong>{getStatusLabel(lead.status)}</strong>.
                          </div>
                        )}
                      </button>

                      {isMeeting && lead.status === "scheduled" && canToggleMeetingHeald && (
                        <div
                          className="mt-2 flex items-center justify-between gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <Checkbox
                              checked={lead.meetingHeald === "yes"}
                              disabled={meetingHealdSavingId === lead.id || !canToggleMeetingHeald}
                              onCheckedChange={(checked) => {
                                void handleToggleMeetingHeald(lead, checked === true)
                              }}
                            />
                            Reunião realizada?
                          </label>
                          {meetingHealdSavingId === lead.id && (
                            <span className="text-xs text-muted-foreground">Salvando...</span>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        {isMeeting ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation()
                                setLeadToSchedule(lead)
                                setScheduleDialogMode("reschedule")
                                setScheduleDialogOpen(true)
                              }}
                            >
                              Reagendar reunião
                            </Button>
                            <Button
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                setLeadToCancel(lead)
                                setCancelDialogOpen(true)
                              }}
                              className="border-foreground/20 hover:border-red-400 border-1 bg-transparent hover:bg-red-500 text-red-500/90 hover:text-white cursor-pointer"
                            >
                              Cancelar agenda
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation()
                              setLeadToSchedule(lead)
                              setScheduleDialogMode("create")
                              setScheduleDialogOpen(true)
                            }}
                          >
                            Agendar reunião
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <LeadDialog
        open={open}
        setOpen={setOpen}
        lead={selected}
        user={user}
        userLoading={userLoading}
        refreshLeads={refreshLeads}
        finalizeContract={finalizeContract}
        patchLead={patchLead}
      />

      <Dialog open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Selecionar lead para agendar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={leadPickerQuery}
              onChange={(event) => setLeadPickerQuery(event.target.value)}
              placeholder="Buscar por nome ou ID"
            />
            <div className="max-h-[360px] overflow-y-auto rounded-md border">
              {leadPickerCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Nenhum lead encontrado.</div>
              ) : (
                leadPickerCandidates.map((lead) => {
                  const closerLabel = getCloserLabel(lead, closersById)
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        setLeadToSchedule(lead)
                        setScheduleDialogMode("create")
                        setLeadPickerOpen(false)
                        setScheduleDialogOpen(true)
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40"
                    >
                      <div>
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {lead.leadCode} • Closer: {closerLabel}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {getStatusLabel(lead.status)}
                      </span>
                    </button>
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
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Cancelar agenda</DialogTitle>
            <DialogDescription>
              Deseja cancelar a agenda atual ou reagendar a reuniao?
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
            <Button
              onClick={handleCancelSchedule}
              className="h-9 border-foreground/20 hover:border-red-400 border-1 bg-transparent hover:bg-red-500 text-red-500/90 hover:text-white"
            >
              Cancelar agenda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
