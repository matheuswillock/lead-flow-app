"use client"

import { useState } from "react"
import {
  Archive,
  BarChart3,
  CalendarX,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Send,
  X,
} from "lucide-react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { CampaignStatusBadge } from "@/components/email/CampaignStatusBadge"
import { formatEmailCreatorLabel } from "@/lib/email/format-email-creator"
import type { StudioEmailCampaign } from "../../services/IBackofficeStudioEmailService"
import { useBackofficeCampanhas } from "../hooks/useBackofficeCampanhas"
import { BackofficeCampaignCreateWizard } from "../components/BackofficeCampaignCreateWizard"
import { BackofficeCampaignDetailSheet } from "../components/BackofficeCampaignDetailSheet"
import { BackofficeCampaignAnalyticsDialog } from "../components/BackofficeCampaignAnalyticsDialog"

const STATUS_FILTER_OPTIONS = [
  { value: "draft", label: "Rascunhos" },
  { value: "scheduled", label: "Agendadas" },
  { value: "sending", label: "Enviando" },
  { value: "sent", label: "Enviadas" },
  { value: "canceled", label: "Canceladas" },
  { value: "failed", label: "Falhou" },
  { value: "archived", label: "Arquivadas" },
]

function CampaignActionsMenu({
  campaign,
  canManage,
  sendingId,
  cancelingId,
  archivingId,
  onView,
  onSend,
  onCancel,
  onArchive,
  onAnalytics,
}: {
  campaign: StudioEmailCampaign
  canManage: boolean
  sendingId: string | null
  cancelingId: string | null
  archivingId: string | null
  onView: () => void
  onSend: () => Promise<void>
  onCancel: () => Promise<void>
  onArchive: () => Promise<void>
  onAnalytics: () => void
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const canSend = canManage && ["draft", "scheduled", "sent", "failed"].includes(campaign.status)
  const canCancel = canManage && campaign.status === "scheduled"
  const canArchive = canManage && ["sent", "failed"].includes(campaign.status)

  async function handleSendConfirm() {
    setSending(true)
    try {
      await onSend()
      setSendConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Ações">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>
            <Eye data-icon="inline-start" />
            Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAnalytics}>
            <BarChart3 data-icon="inline-start" />
            Métricas
          </DropdownMenuItem>
          {canSend ? (
            <DropdownMenuItem onClick={() => setSendConfirmOpen(true)}>
              <Send data-icon="inline-start" />
              Disparar
            </DropdownMenuItem>
          ) : null}
          {canCancel ? (
            <DropdownMenuItem onClick={() => setCancelConfirmOpen(true)}>
              <CalendarX data-icon="inline-start" />
              Cancelar
            </DropdownMenuItem>
          ) : null}
          {canArchive ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setArchiveConfirmOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Archive data-icon="inline-start" />
                Arquivar
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disparar campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>&quot;{campaign.name}&quot;</strong> será enviada para os
              destinatários da lista selecionada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending || sendingId === campaign.id}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleSendConfirm()
              }}
              disabled={sending || sendingId === campaign.id}
            >
              {sending || sendingId === campaign.id ? "Disparando..." : "Sim, disparar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>&quot;{campaign.name}&quot;</strong> voltará para rascunho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelingId === campaign.id}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onCancel()
                setCancelConfirmOpen(false)
              }}
              disabled={cancelingId === campaign.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelingId === campaign.id ? "Cancelando..." : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>&quot;{campaign.name}&quot;</strong> será arquivada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivingId === campaign.id}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onArchive()
                setArchiveConfirmOpen(false)
              }}
              disabled={archivingId === campaign.id}
            >
              {archivingId === campaign.id ? "Arquivando..." : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BackofficeCampanhasContainer() {
  const campanhas = useBackofficeCampanhas()
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsCampaign, setAnalyticsCampaign] = useState<{
    id: string
    name: string
  } | null>(null)

  const dateRange: DateRange | undefined =
    campanhas.dateFrom || campanhas.dateTo
      ? {
          from: campanhas.dateFrom ? new Date(`${campanhas.dateFrom}T00:00:00`) : undefined,
          to: campanhas.dateTo ? new Date(`${campanhas.dateTo}T00:00:00`) : undefined,
        }
      : undefined

  const hasActiveFilters =
    campanhas.nameFilter ||
    campanhas.dateFrom ||
    campanhas.dateTo ||
    campanhas.statusFilter.length > 0

  function openCampaignAnalytics(campaign: StudioEmailCampaign) {
    setAnalyticsCampaign({ id: campaign.id, name: campaign.name })
    setAnalyticsOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {campanhas.total.toLocaleString("pt-BR")} campanha(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setAnalyticsCampaign(null)
              setAnalyticsOpen(true)
            }}
          >
            <BarChart3 data-icon="inline-start" />
            Métricas gerais
          </Button>
          {campanhas.canManage ? (
            <Button type="button" size="sm" onClick={campanhas.openWizard}>
              + Nova campanha
            </Button>
          ) : null}
        </div>
      </div>

      <LeadsFiltersLayout>
        <Input
          className="h-8 w-64 text-sm"
          placeholder="Filtrar por nome..."
          value={campanhas.nameFilter}
          onChange={(e) => campanhas.handleNameFilter(e.target.value)}
        />
        <LeadsMultiFilter
          title="Status"
          options={STATUS_FILTER_OPTIONS}
          selectedValues={campanhas.statusFilter}
          onChange={campanhas.handleStatusFilter}
        />
        <LeadsDateFilter
          title="Data de criação"
          value={dateRange}
          onChange={(range) =>
            campanhas.handleDateFilter(
              range?.from ? format(range.from, "yyyy-MM-dd") : "",
              range?.to ? format(range.to, "yyyy-MM-dd") : ""
            )
          }
        />
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={campanhas.clearFilters}
          >
            <X data-icon="inline-start" />
            Limpar filtros
          </Button>
        ) : null}
      </LeadsFiltersLayout>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Template / Lista</TableHead>
              <TableHead>Criado por</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campanhas.loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : campanhas.campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma campanha encontrada.
                </TableCell>
              </TableRow>
            ) : (
              campanhas.campaigns.map((campaign) => {
                const isSending =
                  campaign.status === "sending" || campanhas.sendingId === campaign.id

                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <CampaignStatusBadge
                          status={isSending ? "sending" : campaign.status}
                          scheduledAt={campaign.scheduledAt}
                        />
                        {campaign.status === "failed" && campaign.errorMessage ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="destructive"
                                className="w-fit max-w-[220px] truncate font-normal"
                              >
                                {campaign.errorMessage}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {campaign.errorMessage}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{campaign.template?.name ?? "—"}</div>
                      <div className="text-xs">{campaign.contactList?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatEmailCreatorLabel(campaign)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSending ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-semantic-warning">
                          <Loader2 className="size-3.5 animate-spin" />
                          Enviando...
                        </span>
                      ) : (
                        <CampaignActionsMenu
                          campaign={campaign}
                          canManage={campanhas.canManage}
                          sendingId={campanhas.sendingId}
                          cancelingId={campanhas.cancelingId}
                          archivingId={campanhas.archivingId}
                          onView={() => void campanhas.openView(campaign)}
                          onSend={() => campanhas.handleSend(campaign.id)}
                          onCancel={() => campanhas.handleCancel(campaign.id)}
                          onArchive={() => campanhas.handleArchive(campaign.id)}
                          onAnalytics={() => openCampaignAnalytics(campaign)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {campanhas.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Página {campanhas.page} de {campanhas.totalPages}</span>
            <Select
              value={String(campanhas.pageSize)}
              onValueChange={(value) => campanhas.handlePageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={campanhas.page <= 1}
              onClick={() => campanhas.handlePageChange(1)}
            >
              <ChevronFirst />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={campanhas.page <= 1}
              onClick={() => campanhas.handlePageChange(campanhas.page - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={campanhas.page >= campanhas.totalPages}
              onClick={() => campanhas.handlePageChange(campanhas.page + 1)}
            >
              <ChevronRight />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={campanhas.page >= campanhas.totalPages}
              onClick={() => campanhas.handlePageChange(campanhas.totalPages)}
            >
              <ChevronLast />
            </Button>
          </div>
        </div>
      ) : null}

      <BackofficeCampaignCreateWizard {...campanhas} />
      <BackofficeCampaignDetailSheet
        {...campanhas}
        onOpenAnalytics={() => {
          if (campanhas.detailCampaign) {
            openCampaignAnalytics(campanhas.detailCampaign)
          }
        }}
      />
      {campanhas.masterId && campanhas.selectedTeamId ? (
        <BackofficeCampaignAnalyticsDialog
          open={analyticsOpen}
          onOpenChange={setAnalyticsOpen}
          masterId={campanhas.masterId}
          teamId={campanhas.selectedTeamId}
          campaignId={analyticsCampaign?.id}
          campaignName={analyticsCampaign?.name}
        />
      ) : null}
    </div>
  )
}
