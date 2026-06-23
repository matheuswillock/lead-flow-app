"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { LeadsStatusFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsStatusFilter"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { getScheduleMeetingStatusBadgeClass } from "@/lib/lead-meeting"
import { getLeadStatusBadgeClass, getLeadStatusLabel } from "@/lib/lead-status"
import type { BackofficeAllUsersScheduleItem } from "../context/BackofficeAllUsersTypes"
import { useBackofficeAllUsers } from "../context/BackofficeAllUsersContext"
import { useBackofficeUserSchedules } from "../hooks/useBackofficeUserSchedules"

const LEAD_STATUS_OPTIONS = [
  { value: "new_opportunity", label: "Nova oportunidade" },
  { value: "scheduled", label: "Agendado" },
  { value: "no_show", label: "No Show" },
  { value: "pricingRequest", label: "Cotação" },
  { value: "future_sale", label: "Venda Futura" },
  { value: "offerNegotiation", label: "Negociação" },
  { value: "pending_documents", label: "Documentos pendentes" },
  { value: "offerSubmission", label: "Proposta" },
  { value: "dps_agreement", label: "DPS | Contrato" },
  { value: "invoicePayment", label: "Boleto" },
  { value: "disqualified", label: "Desqualificado" },
  { value: "opportunityLost", label: "Perdido" },
  { value: "operator_denied", label: "Negado operadora" },
  { value: "contract_finalized", label: "Negócio fechado" },
]

const MEETING_STATUS_OPTIONS = [
  { value: "scheduled", label: "Agendado" },
  { value: "realized", label: "Reunião realizada" },
  { value: "overdue", label: "Vencido" },
  { value: "canceled", label: "Cancelado" },
]

const FUNCTION_FILTER_OPTIONS = [
  { value: "sdr", label: "SDR" },
  { value: "closer", label: "Closer" },
]

function formatMemberName(
  member: BackofficeAllUsersScheduleItem["sdr"] | BackofficeAllUsersScheduleItem["closer"]
) {
  if (!member) return "—"
  return member.fullName?.trim() || member.email || "—"
}

function renderTransferOrigin(item: BackofficeAllUsersScheduleItem) {
  if (!item.transfer) {
    return <span className="text-muted-foreground">—</span>
  }

  const byLine = item.transfer.transferredByName
    ? `Por ${item.transfer.transferredByName}`
    : "Transferência pendente"

  return (
    <div className="flex flex-col gap-1">
      <Badge
        variant="outline"
        className="w-fit border-semantic-info-border bg-semantic-info-surface text-semantic-info"
      >
        Transferência
      </Badge>
      <span className="text-xs text-muted-foreground">
        De {item.transfer.fromTeamName}
        {item.transfer.fromManagerName ? ` (${item.transfer.fromManagerName})` : ""}
      </span>
      <span className="text-xs text-muted-foreground">{byLine}</span>
    </div>
  )
}

export function BackofficeAllUsersSchedulesDialog() {
  const { tz } = useTimezone()
  const {
    service,
    scheduleTarget,
    scheduleDialogOpen,
    closeSchedulesDialog,
  } = useBackofficeAllUsers()

  const {
    filters,
    searchInput,
    dateRange,
    page,
    pageSize,
    items,
    pagination,
    isLoading,
    error,
    hasActiveFilters,
    setPage,
    setPageSize,
    updateFilters,
    handleSearchChange,
    handleDateRangeChange,
    clearFilters,
  } = useBackofficeUserSchedules(service, scheduleTarget, scheduleDialogOpen)

  return (
    <Dialog open={scheduleDialogOpen} onOpenChange={(open) => (!open ? closeSchedulesDialog() : null)}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Agendamentos do usuário</DialogTitle>
          <DialogDescription>
            {scheduleTarget
              ? `Agendamentos do Corretor Studio de ${scheduleTarget.fullName || scheduleTarget.email}. O status da reunião é calculado pelo próprio agendamento; o status do lead aparece separado ao lado.`
              : "Agendamentos do Corretor Studio. O status da reunião é calculado pelo próprio agendamento; o status do lead aparece separado ao lado."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
          <LeadsFiltersLayout
            actions={
              hasActiveFilters ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar
                </Button>
              ) : null
            }
          >
            <Input
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Filtrar por nome..."
              className="h-8 w-full min-w-[12rem] max-w-sm"
            />

            <LeadsMultiFilter
              title="Funções"
              options={FUNCTION_FILTER_OPTIONS}
              selectedValues={filters.functions}
              onChange={(values) =>
                updateFilters({
                  functions: values as typeof filters.functions,
                })
              }
            />

            <LeadsStatusFilter
              title="Status do agendamento"
              statusOptions={MEETING_STATUS_OPTIONS}
              selectedStatuses={filters.meetingStatuses}
              onChangeStatuses={(values) =>
                updateFilters({
                  meetingStatuses: values as typeof filters.meetingStatuses,
                })
              }
            />

            <LeadsStatusFilter
              title="Status do lead"
              statusOptions={LEAD_STATUS_OPTIONS}
              selectedStatuses={filters.leadStatuses}
              onChangeStatuses={(values) => updateFilters({ leadStatuses: values })}
            />

            <LeadsDateFilter
              title="Data de agendamento"
              value={dateRange}
              onChange={handleDateRangeChange}
              allowFutureDates
            />
          </LeadsFiltersLayout>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum agendamento encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[72rem] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">SDR</th>
                    <th className="px-3 py-2 font-medium">Closer</th>
                    <th className="px-3 py-2 font-medium">Papel</th>
                    <th className="px-3 py-2 font-medium">Status da reunião</th>
                    <th className="px-3 py-2 font-medium">Status do lead</th>
                    <th className="px-3 py-2 font-medium">Origem</th>
                    <th className="px-3 py-2 font-medium">Título</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.source}-${item.id}`} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatIntimezone(new Date(item.date), "dd/MM/yyyy", tz)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatIntimezone(new Date(item.date), "HH:mm", tz)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{item.lead.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.lead.email || item.lead.phone || "Sem contato"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">{formatMemberName(item.sdr)}</td>
                      <td className="px-3 py-3">{formatMemberName(item.closer)}</td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={
                            item.role === "closer"
                              ? "border-semantic-info-border bg-semantic-info-surface text-semantic-info"
                              : "border-semantic-success-border bg-semantic-success-surface text-semantic-success"
                          }
                        >
                          {item.role === "closer" ? "Closer" : "SDR"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={getScheduleMeetingStatusBadgeClass(item.meetingStatus)}
                        >
                          {item.meetingStatusLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={getLeadStatusBadgeClass(item.lead.status)}
                        >
                          {getLeadStatusLabel(item.lead.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">{renderTransferOrigin(item)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span>{item.meetingTitle || "Sem título"}</span>
                          {item.meetingLink ? (
                            <Link
                              href={item.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline-offset-4 hover:underline"
                            >
                              Abrir link da reunião
                            </Link>
                          ) : item.notes ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {item.notes}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Linhas por página</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => setPageSize(Number.parseInt(value, 10))}
                >
                  <SelectTrigger className="h-8 w-[5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="size-8"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPreviousPage || isLoading}
                >
                  <ChevronLeft />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="size-8"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNextPage || isLoading}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
