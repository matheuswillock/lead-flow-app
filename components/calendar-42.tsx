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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CirclePlus } from "@/components/animate-ui/icons/circle-plus"
import LeadDialog from "@/app/[supabaseId]/components/LeadDialog"
import useBoardContext from "@/app/[supabaseId]/board/features/context/BoardHook"
import { ScheduleMeetingDialog } from "@/app/[supabaseId]/board/features/container/ScheduleMeetingDialog"
import type { Lead } from "@/app/[supabaseId]/board/features/context/BoardTypes"
import { getLeadStatusLabel } from "@/lib/lead-status"

const SLOT_MINUTES = 30

const buildTimeSlots = () =>
  Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, i) => {
    const totalMinutes = i * SLOT_MINUTES
    const hour = Math.floor(totalMinutes / 60)
    const minute = totalMinutes % 60
    return `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`
  })

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

export default function Calendar42() {
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
  } = useBoardContext()

  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [selectedTime, setSelectedTime] = React.useState<string | null>("09:00")
  const [leadNameFilter, setLeadNameFilter] = React.useState("")
  const [leadIdFilter, setLeadIdFilter] = React.useState("")
  const [closerFilter, setCloserFilter] = React.useState<string[]>([])
  const [leadPickerOpen, setLeadPickerOpen] = React.useState(false)
  const [leadToSchedule, setLeadToSchedule] = React.useState<Lead | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = React.useState(false)
  const [leadPickerQuery, setLeadPickerQuery] = React.useState("")
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [leadToCancel, setLeadToCancel] = React.useState<Lead | null>(null)
  const params = useParams()
  const supabaseId = params.supabaseId as string | undefined

  const timeSlots = React.useMemo(() => buildTimeSlots(), [])

  const allLeads = React.useMemo(
    () => Object.values(data).flat(),
    [data]
  )

  const closers = React.useMemo(() => {
    const list = user?.usersAssociated ?? []
    const closersOnly = list.filter((closer) =>
      (closer.functions || []).includes("CLOSER")
    )
    return closersOnly.length > 0 ? closersOnly : list
  }, [user])

  const closersById = React.useMemo(() => {
    return new Map(closers.map((closer) => [closer.id, closer.name]))
  }, [closers])

  const leadsWithMeetings = React.useMemo(
    () => allLeads.filter((lead) => !!lead.meetingDate),
    [allLeads]
  )

  const dayEvents = React.useMemo(() => {
    if (!date) return []
    return leadsWithMeetings.filter((lead) =>
      lead.meetingDate ? isSameDay(date, new Date(lead.meetingDate)) : false
    )
  }, [date, leadsWithMeetings])

  const filteredEvents = React.useMemo(() => {
    const nameQuery = leadNameFilter.trim().toLowerCase()
    const idQuery = leadIdFilter.trim().toLowerCase()
    return dayEvents.filter((lead) => {
      const meetingDate = lead.meetingDate ? new Date(lead.meetingDate) : null
      const matchesTime =
        !selectedTime || (meetingDate && isWithinSlot(meetingDate, selectedTime))
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
      toast.success(successMessage, {
        description: warningMessage,
      })
    } catch (error) {
      console.error("Erro ao cancelar agenda:", error)
      const message = error instanceof Error ? error.message : "Erro ao cancelar agenda"
      toast.error(message)
    }
  }

  const selectedClosers = closers.filter((closer) =>
    closerFilter.includes(closer.id)
  )

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
              <div className="text-xs font-medium text-muted-foreground">
                Horarios
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTime(null)}
                disabled={!selectedTime}
              >
                Limpar horario
              </Button>
            </div>
            <div className="no-scrollbar flex max-h-[40dvh] flex-col gap-2 overflow-y-auto px-2 lg:max-h-none lg:min-h-0 lg:flex-1">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "default" : "outline"}
                  onClick={() => setSelectedTime(time)}
                  className="w-full shadow-none"
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
                    <Button
                      variant="outline"
                      className="w-full justify-between gap-2 px-3"
                    >
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
                                return prev.includes(closer.id)
                                  ? prev
                                  : [...prev, closer.id]
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
              <Button
                variant="outline"
                onClick={() => setLeadPickerOpen(true)}
                className="group"
              >
                <CirclePlus
                  className="mr-2 transition-transform duration-300 group-hover:rotate-90"
                  size={16}
                />
                Agendar Reunião
              </Button>
            </div>

            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-full flex-1 items-center justify-center text-sm text-muted-foreground">
                  Carregando agendas...
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma agenda para este dia e horario.
                  </p>
                  <Button onClick={() => setLeadPickerOpen(true)}>
                    Agendar nova reunião
                  </Button>
                </div>
              ) : (
                filteredEvents.map((lead) => {
                  const meetingStart = lead.meetingDate
                    ? new Date(lead.meetingDate)
                    : null
                  const meetingEnd = meetingStart
                    ? new Date(meetingStart.getTime() + 60 * 60 * 1000)
                    : null
                  const closerLabel = getCloserLabel(lead, closersById)
                  const meetingTitle = lead.meetingTitle || `Reunião com ${lead.name}`
                  const showLeadName = meetingTitle !== lead.name
                  return (
                    <div
                      key={lead.id}
                      className="bg-muted hover:bg-muted/80 after:bg-primary/70 relative rounded-md p-3 pl-6 text-left text-sm transition-colors after:absolute after:inset-y-3 after:left-3 after:w-1 after:rounded-full"
                    >
                      <button
                        type="button"
                        onClick={() => handleCardClick(lead)}
                        className="flex w-full flex-col gap-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{meetingTitle}</div>
                          <span className="text-xs text-muted-foreground">
                            {lead.leadCode}
                          </span>
                        </div>
                        {showLeadName && (
                          <div className="text-xs text-muted-foreground">
                            Lead: {lead.name}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {meetingStart && meetingEnd
                            ? formatDateRange(meetingStart, meetingEnd)
                            : "Horario indefinido"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Closer: {closerLabel}
                        </div>
                      </button>
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation()
                            setLeadToCancel(lead)
                            setCancelDialogOpen(true)
                          }}
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

      <LeadDialog
        open={open}
        setOpen={setOpen}
        lead={selected}
        user={user}
        userLoading={userLoading}
        refreshLeads={refreshLeads}
        finalizeContract={finalizeContract}
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
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhum lead encontrado.
                </div>
              ) : (
                leadPickerCandidates.map((lead) => {
                  const closerLabel = getCloserLabel(lead, closersById)
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        setLeadToSchedule(lead)
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
            }
          }}
          lead={leadToSchedule}
          onScheduleSuccess={refreshLeads}
          closers={closers}
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
    </div>
  )
}
