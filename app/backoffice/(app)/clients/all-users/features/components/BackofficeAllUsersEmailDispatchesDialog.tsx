"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
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
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import {
  getBackofficeEmailCategoryLabel,
  getBackofficeEmailDispatchStatusBadgeClass,
  getBackofficeEmailDispatchStatusLabel,
  getBackofficeEmailProviderLabel,
  getBackofficeEmailRecipientKindLabel,
} from "@/lib/backoffice-email-dispatch"
import type { BackofficeAllUsersEmailDispatchItem } from "../context/BackofficeAllUsersTypes"
import { useBackofficeAllUsers } from "../context/BackofficeAllUsersContext"
import { useBackofficeUserEmailDispatches } from "../hooks/useBackofficeUserEmailDispatches"

const STATUS_FILTER_OPTIONS = [
  { value: "queued", label: "Na fila" },
  { value: "sent", label: "Disparado" },
  { value: "delivered", label: "Entregue" },
  { value: "opened", label: "Aberto" },
  { value: "clicked", label: "Clicado" },
  { value: "bounced", label: "Recusado pelo provedor" },
  { value: "complained", label: "Marcado como spam" },
  { value: "failed", label: "Disparado com falha" },
  { value: "delivery_delayed", label: "Entrega atrasada" },
  { value: "suppressed", label: "Suprimido" },
]

const PROVIDER_FILTER_OPTIONS = [
  { value: "resend", label: "Resend" },
  { value: "google_calendar", label: "Google Calendar" },
]

const CATEGORY_FILTER_OPTIONS = [
  { value: "access_invite", label: "Convite de acesso" },
  { value: "access_reset", label: "Reset de senha" },
  { value: "invoice_notification", label: "Notificação de fatura" },
  { value: "adhesion_invite", label: "Convite de adesão" },
  { value: "schedule_invite", label: "Convite de agendamento" },
  { value: "welcome", label: "Boas-vindas" },
  { value: "operator_invite", label: "Convite de operador" },
  { value: "meeting_invite", label: "Convite de reunião" },
  { value: "other", label: "Outro" },
]

function formatDispatchStatusLabel(item: BackofficeAllUsersEmailDispatchItem): string {
  if (item.provider === "google_calendar" && item.status === "sent") {
    return "Enviado via Google Calendar"
  }
  return getBackofficeEmailDispatchStatusLabel(item.status)
}

function formatDispatchDate(
  item: BackofficeAllUsersEmailDispatchItem,
  tz: string
): string {
  const dateValue = item.sentAt ?? item.createdAt
  if (!dateValue) return "—"
  return formatIntimezone(new Date(dateValue), "dd/MM/yyyy HH:mm", tz)
}

function EmailDispatchEventsRow({
  item,
  tz,
}: {
  item: BackofficeAllUsersEmailDispatchItem
  tz: string
}) {
  if (item.events.length === 0) {
    return (
      <tr className="border-b bg-muted/20 last:border-0">
        <td colSpan={7} className="px-3 py-2 text-xs text-muted-foreground">
          Nenhum evento registrado para este disparo.
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b bg-muted/20 last:border-0">
      <td colSpan={7} className="px-3 py-3">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Histórico de eventos
          </span>
          <ul className="flex flex-col gap-1">
            {item.events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{event.type}</Badge>
                <span className="text-muted-foreground">
                  {formatIntimezone(new Date(event.occurredAt), "dd/MM/yyyy HH:mm:ss", tz)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </td>
    </tr>
  )
}

export function BackofficeAllUsersEmailDispatchesDialog() {
  const { tz } = useTimezone()
  const {
    service,
    emailDispatchTarget,
    emailDispatchDialogOpen,
    closeEmailDispatchesDialog,
  } = useBackofficeAllUsers()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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
  } = useBackofficeUserEmailDispatches(service, emailDispatchTarget, emailDispatchDialogOpen)

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog
      open={emailDispatchDialogOpen}
      onOpenChange={(open) => (!open ? closeEmailDispatchesDialog() : null)}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>E-mails disparados</DialogTitle>
          <DialogDescription>
            {emailDispatchTarget
              ? `Histórico de e-mails transacionais enviados para ${emailDispatchTarget.fullName || emailDispatchTarget.email}.`
              : "Histórico de e-mails transacionais enviados para o usuário."}
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
              placeholder="Buscar por assunto ou destinatário..."
              className="h-8 w-full min-w-[12rem] max-w-sm"
            />

            <LeadsMultiFilter
              title="Status"
              options={STATUS_FILTER_OPTIONS}
              selectedValues={filters.statuses}
              onChange={(values) =>
                updateFilters({
                  statuses: values as typeof filters.statuses,
                })
              }
            />

            <LeadsMultiFilter
              title="Provedor"
              options={PROVIDER_FILTER_OPTIONS}
              selectedValues={filters.providers}
              onChange={(values) =>
                updateFilters({
                  providers: values as typeof filters.providers,
                })
              }
            />

            <LeadsMultiFilter
              title="Categoria"
              options={CATEGORY_FILTER_OPTIONS}
              selectedValues={filters.categories}
              onChange={(values) =>
                updateFilters({
                  categories: values as typeof filters.categories,
                })
              }
            />

            <LeadsDateFilter
              title="Data do disparo"
              value={dateRange}
              onChange={handleDateRangeChange}
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
              Nenhum e-mail encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-medium">Destinatário</th>
                    <th className="px-3 py-2 font-medium">Assunto</th>
                    <th className="px-3 py-2 font-medium">Categoria</th>
                    <th className="px-3 py-2 font-medium">Provedor</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Eventos</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isExpanded = expandedIds.has(item.id)
                    return (
                      <Fragment key={item.id}>
                        <tr className="border-b align-top last:border-0">
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{item.recipientEmail}</span>
                              <Badge variant="outline" className="w-fit">
                                {getBackofficeEmailRecipientKindLabel(item.recipientKind)}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span>{item.subject}</span>
                              {item.errorMessage ? (
                                <span className="text-xs text-destructive">{item.errorMessage}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {getBackofficeEmailCategoryLabel(item.category)}
                          </td>
                          <td className="px-3 py-3">
                            {getBackofficeEmailProviderLabel(item.provider)}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant="outline"
                              className={getBackofficeEmailDispatchStatusBadgeClass(item.status)}
                            >
                              {formatDispatchStatusLabel(item)}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            {formatDispatchDate(item, tz)}
                          </td>
                          <td className="px-3 py-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(item.id)}
                            >
                              {isExpanded ? <ChevronUp /> : <ChevronDown />}
                              {isExpanded ? "Ocultar" : "Ver"}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <EmailDispatchEventsRow item={item} tz={tz} />
                        ) : null}
                      </Fragment>
                    )
                  })}
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
