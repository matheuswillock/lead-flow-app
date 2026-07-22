"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  Clock,
  HelpCircle,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatLocalDateValue, formatLocalTimeValue, parseDateKeyAndTimeToUtc } from "@/lib/dates"
import {
  BACKOFFICE_CRM_STATUS_LABELS,
} from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes"
import { BackofficeLeadScheduleDialog } from "@/app/backoffice/(app)/crm/features/components/BackofficeLeadScheduleDialog"
import type {
  BackofficeLeadItem,
  BackofficeLeadScheduleInput,
} from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes"
import { useBackofficeCalendar } from "../context/BackofficeCalendarHook"

const SLOT_MINUTES = 30
const ALL_TIME_SLOTS = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => {
  const totalMinutes = index * SLOT_MINUTES
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
})

const RSVP_ICON: Record<string, React.ElementType> = {
  accepted: CheckCircle2,
  declined: XCircle,
  tentative: HelpCircle,
  needsAction: Clock,
}

const RSVP_COLOR: Record<string, string> = {
  accepted: "border-green-500/30 bg-green-500/10 text-green-600",
  declined: "border-red-500/30 bg-red-500/10 text-red-600",
  tentative: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
  needsAction: "border-border bg-muted text-muted-foreground",
}

const RSVP_LABEL: Record<string, string> = {
  accepted: "Confirmado",
  declined: "Recusado",
  tentative: "Talvez",
  needsAction: "Aguardando",
}

const SOURCE_LABEL: Record<string, string> = {
  lead: "Lead",
  closer: "Closer",
  extra: "Convidado",
  google: "",
}

function leadIncludesQuery(lead: BackofficeLeadItem, nameQuery: string, idQuery: string) {
  const normalizedName = nameQuery.trim().toLowerCase()
  const normalizedId = idQuery.trim().toLowerCase()
  if (normalizedName && !lead.name.toLowerCase().includes(normalizedName)) return false
  if (normalizedId && !lead.id.toLowerCase().includes(normalizedId)) return false
  return true
}

export function BackofficeCalendarContainer() {
  const {
    leads,
    users,
    closers,
    isLoading,
    error,
    timezone,
    getAvailability,
    scheduleLead,
    cancelSchedule,
    getAttendees,
  } = useBackofficeCalendar()

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [idQuery, setIdQuery] = useState("")
  const [closerFilter, setCloserFilter] = useState<string[]>([])
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [leadPickerQuery, setLeadPickerQuery] = useState("")
  const [leadToSchedule, setLeadToSchedule] = useState<BackofficeLeadItem | null>(null)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [leadToCancel, setLeadToCancel] = useState<BackofficeLeadItem | null>(null)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [availableTimes, setAvailableTimes] = useState<string[] | null>(null)
  const [attendeesByLead, setAttendeesByLead] = useState<
    Record<
      string,
      {
        hasGoogleData: boolean
        attendees: Array<{ email: string; name: string | null; responseStatus: string; source: string }>
      }
    >
  >({})
  const timeListRef = useRef<HTMLDivElement>(null)

  const dateKey = selectedDate ? formatLocalDateValue(selectedDate, timezone) : ""

  const scheduledLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (lead.status !== "scheduled" || !lead.meetingDate) return false
        const leadDateKey = formatLocalDateValue(new Date(lead.meetingDate), timezone)
        const leadTime = formatLocalTimeValue(new Date(lead.meetingDate), timezone)
        if (leadDateKey !== dateKey) return false
        if (selectedTime && leadTime !== selectedTime) return false
        if (!leadIncludesQuery(lead, query, idQuery)) return false
        if (closerFilter.length > 0 && !closerFilter.includes(lead.closerBackofficeUserId ?? "")) {
          return false
        }
        return true
      }),
    [closerFilter, dateKey, idQuery, leads, query, selectedTime, timezone]
  )

  const availabilityCloserIds = useMemo(
    () => (closerFilter.length === 0 ? closers.map((c) => c.id) : closerFilter),
    [closerFilter, closers]
  )

  const selectedClosers = useMemo(
    () => closers.filter((c) => closerFilter.includes(c.id)),
    [closers, closerFilter]
  )

  const leadPickerCandidates = useMemo(() => {
    const q = leadPickerQuery.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(q) ||
        lead.id.toLowerCase().includes(q)
    )
  }, [leads, leadPickerQuery])

  const dialogLead = useMemo(() => {
    if (!leadToSchedule) return null
    const preferredDate =
      selectedTime && dateKey
        ? parseDateKeyAndTimeToUtc(dateKey, selectedTime, timezone).toISOString()
        : leadToSchedule.meetingDate
    return {
      id: leadToSchedule.id,
      name: leadToSchedule.name,
      email: leadToSchedule.email,
      closerBackofficeUserId: leadToSchedule.closerBackofficeUserId,
      meetingDate: preferredDate,
      meetingTitle: leadToSchedule.meetingTitle,
      meetingNotes: leadToSchedule.meetingNotes,
      meetingLink: leadToSchedule.meetingLink,
      meetingType: leadToSchedule.meetingType,
      meetingExtraGuests: leadToSchedule.meetingExtraGuests,
    }
  }, [dateKey, leadToSchedule, selectedTime, timezone])

  useEffect(() => {
    if (!dateKey || availabilityCloserIds.length === 0) {
      setAvailableTimes(null)
      return
    }

    let active = true
    void getAvailability({ closerIds: availabilityCloserIds, date: dateKey, timezone })
      .then((availability) => {
        if (!active) return
        setAvailableTimes(availability.availableTimes)
        if (selectedTime && !availability.availableTimes.includes(selectedTime)) {
          setSelectedTime(null)
        }
      })
      .catch((err) => {
        console.warn("[BackofficeCalendarContainer][availability]", err)
        if (active) setAvailableTimes(null)
      })

    return () => {
      active = false
    }
  }, [availabilityCloserIds, dateKey, getAvailability, selectedTime, timezone])

  const visibleLeadIds = useMemo(
    () => scheduledLeads.map((lead) => lead.id).join("|"),
    [scheduledLeads]
  )

  useEffect(() => {
    const ids = visibleLeadIds ? visibleLeadIds.split("|") : []
    const missingIds = ids.filter((id) => !attendeesByLead[id])
    if (missingIds.length === 0) return

    let active = true
    void Promise.all(
      missingIds.map(async (id) => {
        try {
          return [id, await getAttendees(id)] as const
        } catch {
          return null
        }
      })
    ).then((entries) => {
      if (!active) return
      setAttendeesByLead((prev) => {
        const next = { ...prev }
        entries.forEach((entry) => {
          if (entry) next[entry[0]] = entry[1]
        })
        return next
      })
    })

    return () => {
      active = false
    }
  }, [attendeesByLead, getAttendees, visibleLeadIds])

  function openLeadPicker() {
    setLeadPickerQuery("")
    setLeadPickerOpen(true)
  }

  function pickLeadToSchedule(lead: BackofficeLeadItem) {
    setLeadToSchedule(lead)
    setLeadPickerOpen(false)
    setIsScheduleDialogOpen(true)
  }

  function openRescheduleDialog(lead: BackofficeLeadItem) {
    setLeadToSchedule(lead)
    setIsScheduleDialogOpen(true)
  }

  function openCancelDialog(lead: BackofficeLeadItem) {
    setLeadToCancel(lead)
    setIsCancelDialogOpen(true)
  }

  function openRescheduleFromCancel() {
    if (!leadToCancel) return
    setLeadToSchedule(leadToCancel)
    setIsCancelDialogOpen(false)
    setLeadToCancel(null)
    setIsScheduleDialogOpen(true)
  }

  async function handleScheduleConfirm(input: BackofficeLeadScheduleInput) {
    if (!leadToSchedule) return
    await scheduleLead(leadToSchedule.id, input)
    setAttendeesByLead((prev) => {
      const next = { ...prev }
      delete next[leadToSchedule.id]
      return next
    })
  }

  async function handleCancelSchedule() {
    if (!leadToCancel) return
    try {
      await cancelSchedule(leadToCancel.id)
      setAttendeesByLead((prev) => {
        const next = { ...prev }
        delete next[leadToCancel.id]
        return next
      })
      setIsCancelDialogOpen(false)
      setLeadToCancel(null)
      toast.success("Agendamento cancelado. Lead voltou para Nova oportunidade.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cancelar agendamento")
    }
  }

  async function handleResendInvite(leadId: string) {
    const response = await fetch(`/api/v1/backoffice/leads/${leadId}/schedule/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "all" }),
    })
    const output = await response.json()
    if (!response.ok || !output?.isValid) {
      throw new Error(
        Array.isArray(output?.errorMessages)
          ? output.errorMessages.join(", ")
          : "Não foi possível reenviar o convite"
      )
    }
    toast.success("Convite reenviado")
  }

  async function handleCopyPublicShareLink(leadId: string) {
    const response = await fetch(`/api/v1/backoffice/leads/${leadId}/schedule/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const output = await response.json()
    if (!response.ok || !output?.isValid || !output?.result?.publicUrl) {
      throw new Error(
        Array.isArray(output?.errorMessages)
          ? output.errorMessages.join(", ")
          : "Não foi possível gerar o link público"
      )
    }
    await navigator.clipboard.writeText(String(output.result.publicUrl))
    toast.success("Link público copiado")
  }

  return (
    <div className="flex min-h-0 h-full w-full max-w-full flex-1 flex-col gap-4 overflow-x-hidden p-4">
      <div className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:h-full">

        {/* LEFT: Calendar + Time Slots */}
        <Card className="w-full min-h-0 lg:h-full">
          <CardContent className="flex h-full min-h-0 flex-col gap-4 py-4 px-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              month={selectedDate ?? new Date()}
              onSelect={(date) => {
                setSelectedDate(date)
                setSelectedTime(null)
              }}
              onMonthChange={(month) => {
                setSelectedDate(month)
                setSelectedTime(null)
              }}
              locale={ptBR}
              showOutsideDays={false}
              weekdayLabelFormat="short"
              className="bg-transparent p-0 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
              formatters={{
                formatMonthCaption: (date) => {
                  const raw = format(date, "MMM", { locale: ptBR })
                  const month = raw.endsWith(".") ? raw : `${raw}.`
                  return `${month} ${format(date, "yyyy")}`
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
                  type="button"
                  variant={selectedTime === time ? "default" : "outline"}
                  disabled={availableTimes !== null && !availableTimes.includes(time)}
                  onClick={() => setSelectedTime(time)}
                  className="w-full shadow-none"
                >
                  {time}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Filters + Events */}
        <Card className="h-full w-full min-h-0">
          <CardContent className="flex h-full min-h-0 w-full flex-col gap-4 p-4">

            {/* Filters */}
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="w-full min-w-0">
                <Label htmlFor="backoffice-calendar-name" className="text-xs">
                  Nome do lead
                </Label>
                <Input
                  id="backoffice-calendar-name"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrar por nome"
                  className="w-full max-w-none"
                />
              </div>
              <div className="w-full min-w-0">
                <Label htmlFor="backoffice-calendar-id" className="text-xs">
                  ID do lead
                </Label>
                <Input
                  id="backoffice-calendar-id"
                  value={idQuery}
                  onChange={(event) => setIdQuery(event.target.value)}
                  placeholder="ID ou código"
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
                        <span className="truncate">{selectedClosers[0].name}</span>
                      )}
                      {selectedClosers.length > 1 && (
                        <span>{selectedClosers.length} closers</span>
                      )}
                      <span className="ml-auto text-muted-foreground">▼</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuCheckboxItem
                      checked={closerFilter.length === 0}
                      onCheckedChange={(checked) => {
                        if (checked) setCloserFilter([])
                      }}
                    >
                      Todos
                    </DropdownMenuCheckboxItem>
                    {closers.map((closer) => (
                      <DropdownMenuCheckboxItem
                        key={closer.id}
                        checked={closerFilter.includes(closer.id)}
                        onCheckedChange={(nextChecked) => {
                          setCloserFilter((prev) => {
                            if (nextChecked) {
                              return prev.includes(closer.id) ? prev : [...prev, closer.id]
                            }
                            return prev.filter((id) => id !== closer.id)
                          })
                        }}
                      >
                        {closer.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Date/time display + Schedule button */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {selectedDate
                    ? new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "full",
                        timeZone: timezone,
                      }).format(selectedDate)
                    : "Selecione um dia"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedTime ? `Horário: ${selectedTime}` : "Sem horário selecionado"}
                </div>
              </div>
              <Button variant="outline" onClick={openLeadPicker} className="group">
                <CirclePlus
                  className="mr-2 transition-transform duration-300 group-hover:rotate-90"
                  size={16}
                />
                Agendar Reunião
              </Button>
            </div>

            {/* Events list */}
            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-28 w-full rounded-md" />
                ))
              ) : error ? (
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              ) : scheduledLeads.length === 0 ? (
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma agenda ou lembrete para este dia e horário.
                  </p>
                  <Button onClick={openLeadPicker}>Agendar nova reunião</Button>
                </div>
              ) : (
                scheduledLeads.map((lead) => {
                  const closer = closers.find((c) => c.id === lead.closerBackofficeUserId)
                  const attendeeInfo = attendeesByLead[lead.id]
                  const meetingTitle =
                    lead.meetingTitle || `Demonstração Corretor Studio - ${lead.name}`

                  return (
                    <div
                      key={lead.id}
                      className="bg-muted hover:bg-muted/80 after:bg-primary/70 relative rounded-md p-3 pl-6 text-left text-sm transition-colors after:absolute after:inset-y-3 after:left-3 after:w-1 after:rounded-full"
                    >
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{meetingTitle}</div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {lead.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">Lead: {lead.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.meetingDate
                            ? new Intl.DateTimeFormat("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                                timeZone: timezone,
                              }).format(new Date(lead.meetingDate))
                            : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Closer: {closer?.name ?? lead.closer?.name ?? "—"}
                        </div>

                        {attendeeInfo ? (
                          <div className="mt-1.5 flex flex-col gap-1">
                            {!attendeeInfo.hasGoogleData && (
                              <span className="text-[10px] italic text-muted-foreground">
                                Confirmações indisponíveis (envio por e-mail)
                              </span>
                            )}
                            {attendeeInfo.attendees.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {attendeeInfo.attendees.map((a) => {
                                  const status =
                                    a.responseStatus in RSVP_ICON
                                      ? a.responseStatus
                                      : "needsAction"
                                  const Icon = (RSVP_ICON[status] ?? Clock) as React.ElementType
                                  const sourceLabel = SOURCE_LABEL[a.source] ?? ""
                                  return (
                                    <span
                                      key={a.email}
                                      title={a.email}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
                                        RSVP_COLOR[status] ?? RSVP_COLOR.needsAction
                                      )}
                                    >
                                      <Icon className="size-3 shrink-0" />
                                      {sourceLabel && (
                                        <span className="opacity-60">{sourceLabel}</span>
                                      )}
                                      <span>{a.name ?? a.email.split("@")[0]}</span>
                                      <span className="opacity-40">·</span>
                                      <span>{RSVP_LABEL[status] ?? "Aguardando"}</span>
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleCopyPublicShareLink(lead.id).catch((err) => {
                              toast.error(
                                err instanceof Error
                                  ? err.message
                                  : "Erro ao copiar link público"
                              )
                            })
                          }}
                        >
                          Copiar link público
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleResendInvite(lead.id).catch((err) => {
                              toast.error(
                                err instanceof Error ? err.message : "Erro ao reenviar convite"
                              )
                            })
                          }}
                        >
                          Reenviar convite
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRescheduleDialog(lead)}
                        >
                          Reagendar reunião
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openCancelDialog(lead)}
                          className="border-foreground/20 hover:border-red-400 border bg-transparent hover:bg-red-500 text-red-500/90 hover:text-white cursor-pointer"
                        >
                          Cancelar agenda
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Picker Dialog */}
      <Dialog
        open={leadPickerOpen}
        onOpenChange={(nextOpen) => {
          setLeadPickerOpen(nextOpen)
          if (!nextOpen) setLeadPickerQuery("")
        }}
      >
        <DialogContent className="sm:max-w-130">
          <DialogHeader>
            <DialogTitle>Selecionar lead para agendar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={leadPickerQuery}
              onChange={(event) => setLeadPickerQuery(event.target.value)}
              placeholder="Buscar por nome ou ID"
            />
            <div className="max-h-90 overflow-y-auto rounded-md border">
              {leadPickerCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhum lead encontrado.
                </div>
              ) : (
                leadPickerCandidates.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => pickLeadToSchedule(lead)}
                    className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40 last:border-b-0"
                  >
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {lead.id.slice(0, 8)} · Closer: {lead.closer?.name ?? "—"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {BACKOFFICE_CRM_STATUS_LABELS[lead.status]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule/Reschedule Dialog */}
      {dialogLead && (
        <BackofficeLeadScheduleDialog
          open={isScheduleDialogOpen}
          lead={dialogLead}
          closerOptions={closers}
          guestOptions={users}
          onOpenChange={(nextOpen) => {
            setIsScheduleDialogOpen(nextOpen)
            if (!nextOpen) setLeadToSchedule(null)
          }}
          onConfirm={handleScheduleConfirm}
          isReschedule={!!leadToSchedule?.meetingDate || leadToSchedule?.status === "scheduled"}
          onResendInvite={
            leadToSchedule
              ? async () => {
                  const response = await fetch(
                    `/api/v1/backoffice/leads/${leadToSchedule.id}/schedule/resend`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ target: "all" }),
                    }
                  )
                  const output = await response.json()
                  if (!response.ok || !output?.isValid) {
                    throw new Error(
                      Array.isArray(output?.errorMessages)
                        ? output.errorMessages.join(", ")
                        : "Não foi possível reenviar o convite"
                    )
                  }
                  toast.success("Convite reenviado")
                }
              : undefined
          }
        />
      )}

      {/* Cancel Dialog */}
      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsCancelDialogOpen(nextOpen)
          if (!nextOpen) setLeadToCancel(null)
        }}
      >
        <DialogContent className="sm:max-w-105">
          <DialogHeader>
            <DialogTitle>Cancelar agenda</DialogTitle>
            <DialogDescription>
              Cancelar remove o agendamento e devolve o lead para Nova oportunidade.
              Você também pode reagendar a reunião.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={openRescheduleFromCancel}>
              Reagendar
            </Button>
            <Button
              onClick={() => void handleCancelSchedule()}
              className="border-foreground/20 hover:border-red-400 border bg-transparent hover:bg-red-500 text-red-500/90 hover:text-white"
            >
              Cancelar agenda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
