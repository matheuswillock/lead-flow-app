"use client"

import { useState } from "react"
import { Archive, CalendarX, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Copy, Eye, Loader2, MoreHorizontal, Send, Trash2, Pencil, BarChart3, ScrollText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
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
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { useCampanhasContext } from "../context/CampanhasContext"
import type { Campaign } from "../context/CampanhasTypes"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { formatEmailCreatorLabel } from "@/lib/email/format-email-creator"
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime"
import { getCampaignSendBlockReason } from "../utils/getCampaignSendBlockReason"

function CampaignActionsMenu({
  campaign,
  canSendCampaign,
  sendBlockReason,
  deletingId,
  cancelingId,
  archivingId,
  readOnly,
  openView,
  openEditWizard,
  openDuplicateWizard,
  handleSend,
  handleCancel,
  handleDeleteDraft,
  handleArchive,
  onOpenAnalytics,
}: {
  campaign: Campaign
  canSendCampaign: boolean
  sendBlockReason?: string
  deletingId: string | null
  cancelingId: string | null
  archivingId: string | null
  readOnly: boolean
  openView: (campaign: Campaign) => void
  openEditWizard: (campaign: Campaign) => void
  openDuplicateWizard: (campaign: Campaign) => void
  handleSend: (id: string, options?: { retryFailedOnly?: boolean }) => Promise<void>
  handleCancel: (id: string) => Promise<void>
  handleDeleteDraft: (id: string) => Promise<void>
  handleArchive: (id: string) => Promise<void>
  onOpenAnalytics: (campaign: Campaign, defaultTab?: "metrics" | "logs") => void
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const isParentCampaign = Boolean(campaign.isParentCampaign || (campaign.subCampaignCount ?? 0) > 0)
  const isFailedRetryStatus =
    campaign.status === "failed" || campaign.status === "partially_sent"
  const canRetryFailedSubs = isParentCampaign && isFailedRetryStatus
  const canSendByStatus =
    !isParentCampaign &&
    (campaign.status === "draft" ||
      campaign.status === "scheduled" ||
      campaign.status === "sent" ||
      campaign.status === "failed" ||
      campaign.status === "partially_sent")
  const canSend = canSendCampaign && canSendByStatus && !sendBlockReason
  const isLeafFailedRetry = !isParentCampaign && isFailedRetryStatus
  const sendActionLabel = canRetryFailedSubs || isLeafFailedRetry
    ? "Redisparar falhas"
    : "Disparar"
  const failedRetryCount =
    campaign.failedRetryRecipientCount ??
    Math.max(0, campaign.totalRecipients - campaign.totalSent)
  const sendDisabledReason =
    sendBlockReason ??
    (isParentCampaign
      ? canRetryFailedSubs
        ? 'Abra a campanha e use "Reenviar apenas falhas" nas partes com falha'
        : "Campanha-pai não pode ser disparada. As sub-campanhas seguem o agendamento"
      : !canSendCampaign
        ? "Ative um plano em Assinaturas para disparar campanhas"
        : undefined)
  const canEdit = ["draft", "scheduled"].includes(campaign.status)
  const canCancel = campaign.status === "scheduled"
  const canDelete = ["draft", "scheduled", "canceled"].includes(campaign.status)
  const canArchive = ["sent", "failed", "partially_sent"].includes(campaign.status)

  async function handleSendConfirm() {
    setSending(true)
    try {
      await handleSend(
        campaign.id,
        isLeafFailedRetry ? { retryFailedOnly: true } : undefined
      )
    } finally {
      setSending(false)
      setSendConfirmOpen(false)
    }
  }

  async function handleCancelConfirm() {
    await handleCancel(campaign.id)
    setCancelConfirmOpen(false)
  }

  async function handleDeleteConfirm() {
    await handleDeleteDraft(campaign.id)
    setDeleteConfirmOpen(false)
  }

  async function handleArchiveConfirm() {
    await handleArchive(campaign.id)
    setArchiveConfirmOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>

          <DropdownMenuItem onClick={() => openView(campaign)}>
            <Eye className="mr-2 h-4 w-4" />
            Visualizar
          </DropdownMenuItem>
          {!readOnly ? (
            <>
              {canRetryFailedSubs ? (
                <DropdownMenuItem onClick={() => openView(campaign)}>
                  <Send className="mr-2 h-4 w-4" />
                  {sendActionLabel}
                </DropdownMenuItem>
              ) : sendDisabledReason && !canSend ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <DropdownMenuItem disabled className="pointer-events-none w-full">
                        <Send className="mr-2 h-4 w-4" />
                        {sendActionLabel}
                      </DropdownMenuItem>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">{sendDisabledReason}</TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenuItem onClick={() => setSendConfirmOpen(true)} disabled={!canSend}>
                  <Send className="mr-2 h-4 w-4" />
                  {sendActionLabel}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => void openEditWizard(campaign)} disabled={!canEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void openDuplicateWizard(campaign)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuItem onClick={() => onOpenAnalytics(campaign)}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Métricas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpenAnalytics(campaign, "logs")}>
            <ScrollText className="mr-2 h-4 w-4" />
            Ver logs
          </DropdownMenuItem>
          {!readOnly ? (
            <>
              <DropdownMenuItem
                onClick={() => setCancelConfirmOpen(true)}
                disabled={!canCancel || cancelingId === campaign.id}
              >
                <CalendarX className="mr-2 h-4 w-4" />
                {cancelingId === campaign.id ? "Cancelando..." : "Cancelar agendamento"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={deletingId === campaign.id}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deletingId === campaign.id ? "Excluindo..." : "Excluir"}
                </DropdownMenuItem>
              )}
              {canArchive && (
                <DropdownMenuItem
                  onClick={() => setArchiveConfirmOpen(true)}
                  disabled={archivingId === campaign.id}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {archivingId === campaign.id ? "Arquivando..." : "Arquivar"}
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLeafFailedRetry
                ? "Reenviar apenas as falhas?"
                : "Confirmar disparo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isLeafFailedRetry ? (
                <>
                  A campanha <strong>&quot;{campaign.name}&quot;</strong> será reenviada
                  apenas para{" "}
                  <strong>{failedRetryCount.toLocaleString("pt-BR")}</strong>{" "}
                  destinatário(s) que falharam. Quem já recebeu{" "}
                  <strong>não</strong> será reenviado. Os créditos correspondentes
                  serão deduzidos só desse reenvio.
                </>
              ) : (
                <>
                  A campanha <strong>&quot;{campaign.name}&quot;</strong> será enviada para{" "}
                  <strong>{campaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
                  destinatário(s) ativo(s).
                  {campaign.status === "sent"
                    ? " Campanhas já enviadas geram um novo dispatch sem alterar o histórico anterior."
                    : null}{" "}
                  Os créditos correspondentes serão deduzidos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleSendConfirm()
              }}
              disabled={sending || (isLeafFailedRetry && failedRetryCount <= 0)}
            >
              {sending
                ? isLeafFailedRetry
                  ? "Reenviando falhas..."
                  : "Disparando..."
                : isLeafFailedRetry
                  ? "Sim, reenviar apenas falhas"
                  : "Sim, disparar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>"{campaign.name}"</strong> voltará para rascunho e não será
              disparada no horário agendado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelingId === campaign.id}>
              Manter agendamento
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleCancelConfirm()
              }}
              disabled={cancelingId === campaign.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelingId === campaign.id ? "Cancelando..." : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>"{campaign.name}"</strong> será removida permanentemente. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId === campaign.id}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteConfirm()
              }}
              disabled={deletingId === campaign.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId === campaign.id ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>"{campaign.name}"</strong> será arquivada e não aparecerá mais na
              lista. Os dados e métricas serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivingId === campaign.id}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleArchiveConfirm()
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

export function CampaignList({
  onOpenAnalytics,
}: {
  onOpenAnalytics: (campaign: Campaign, defaultTab?: "metrics" | "logs") => void
}) {
  const { tz } = useTimezone()
  const { isBeta } = useFeatureAccess()
  const { readOnly } = useStudioEmailRuntime()
  const {
    campaigns,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    deletingId,
    cancelingId,
    archivingId,
    sendingId,
    handleSend,
    handleCancel,
    handleDeleteDraft,
    handleArchive,
    handlePageChange,
    handlePageSizeChange,
    openWizard,
    openView,
    openEditWizard,
    openDuplicateWizard,
    credits,
  } = useCampanhasContext()
  const isCampaignsBetaAccess = isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const canSendCampaign =
    !!credits?.hasSubscription || isCampaignsBetaAccess || !!credits?.isBetaExempt

  function getSendBlockReason(campaign: Campaign): string | undefined {
    return getCampaignSendBlockReason({
      campaign,
      credits,
      isCampaignsBetaAccess,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border">
        <Table className="min-w-[1180px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Nome</TableHead>
              <TableHead className="text-center">Criado por</TableHead>
              <TableHead className="text-center">Template / Lista</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Destinatários</TableHead>
              <TableHead className="text-center">Qtd. disparos</TableHead>
              <TableHead className="text-center">Data de criação</TableHead>
              <TableHead className="text-center">Último disparo</TableHead>
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Nenhuma campanha encontrada
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Crie uma campanha para disparar comunicações para a sua base.
                      </p>
                    </div>
                    <Button type="button" size="sm" onClick={() => void openWizard()} disabled={readOnly}>
                      Criar campanha
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((campaign) => {
                const isSending =
                  campaign.status === "sending" || sendingId === campaign.id

                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="align-middle text-center font-medium">
                      <div className="flex flex-col items-center gap-1">
                        <span>{campaign.name}</span>
                        {(campaign.subCampaignCount ?? 0) > 0 ? (
                          <Badge variant="secondary">
                            {campaign.subCampaignCount} sub-campanhas
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-middle text-center text-sm text-muted-foreground">
                      {formatEmailCreatorLabel(campaign)}
                    </TableCell>
                    <TableCell className="align-middle text-center text-sm text-muted-foreground">
                      <div>{campaign.template?.name ?? "—"}</div>
                      <div className="text-xs">{campaign.contactList?.name ?? "—"}</div>
                    </TableCell>
                    <TableCell className="align-middle text-center">
                      <div className="flex flex-col items-center gap-1">
                        <CampaignStatusBadge
                          status={isSending ? "sending" : campaign.status}
                          scheduledAt={campaign.scheduledAt}
                        />
                        {(campaign.status === "failed" || campaign.status === "partially_sent") && campaign.errorMessage ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="destructive"
                                className="w-fit max-w-[220px] truncate font-normal"
                              >
                                {campaign.errorMessage}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">{campaign.errorMessage}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-middle text-center text-sm">
                      {campaign.totalRecipients.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="align-middle text-center text-sm text-muted-foreground">
                      {campaign.dispatchCount.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="align-middle text-center text-sm text-muted-foreground">
                      {formatIntimezone(new Date(campaign.createdAt), "dd/MM/yyyy", tz)}
                    </TableCell>
                    <TableCell className="align-middle text-center text-sm text-muted-foreground">
                      {campaign.sentAt
                        ? formatIntimezone(new Date(campaign.sentAt), "dd/MM/yyyy HH:mm", tz)
                        : "—"}
                    </TableCell>
                    <TableCell className="align-middle text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isSending ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-semantic-warning">
                            <Loader2 className="size-3.5 animate-spin" />
                            Enviando...
                          </span>
                        ) : (
                          <CampaignActionsMenu
                            campaign={campaign}
                            canSendCampaign={canSendCampaign}
                            sendBlockReason={getSendBlockReason(campaign)}
                            deletingId={deletingId}
                            cancelingId={cancelingId}
                            archivingId={archivingId}
                            readOnly={readOnly}
                            openView={openView}
                            openEditWizard={openEditWizard}
                            openDuplicateWizard={openDuplicateWizard}
                            handleSend={handleSend}
                            handleCancel={handleCancel}
                            handleDeleteDraft={handleDeleteDraft}
                            handleArchive={handleArchive}
                            onOpenAnalytics={onOpenAnalytics}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{total.toLocaleString("pt-BR")} campanha(s)</span>
          <div className="flex items-center gap-2">
            <span>Linhas por página</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => handlePageSizeChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(1)}
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1 || loading}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">Página {page} de {totalPages || 1}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages || loading}
            onClick={() => handlePageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages || loading}
            onClick={() => handlePageChange(totalPages)}
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
