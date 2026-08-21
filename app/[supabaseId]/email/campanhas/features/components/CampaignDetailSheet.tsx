"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { BarChart3, CalendarX, Copy, Eye, GitBranch, Loader2, MoreHorizontal, Pencil, Radar, Send, ScrollText, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { formatEmailCreatorLabel } from "@/lib/email/format-email-creator"
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
import {
  CampaignDispatchProgressLine,
  resolveCampaignDispatchProgressDisplay,
} from "./CampaignDispatchProgressLine"
import { CampaignDispatchCountdownButtonLabel } from "./CampaignDispatchCountdownButtonLabel"
import { useCampaignDispatchCountdown } from "../hooks/useCampaignDispatchCountdown"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import type { SubCampaignSummary } from "../context/CampanhasTypes"
import { getCampaignSendBlockReason } from "../utils/getCampaignSendBlockReason"
import {
  CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY,
  CAMPAIGN_CANCEL_SENDING_UNSENT_COPY,
  campaignDispatchSendOptions,
  formatCampaignDispatchErrorMessage,
  isCampaignFailedRetry,
} from "@/lib/email/campaign-dispatch-copy"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime"
import { buildCampaignRadarSegmentSlug } from "@/lib/radar/segment-audience"
import { GenerateSegmentDialog } from "@/app/[supabaseId]/radar/features/components/GenerateSegmentDialog"
import { DispatchEmailPreviewDialog } from "./analytics/DispatchEmailPreviewDialog"
import type { DispatchPreviewData } from "./analytics/AnalyticsTypes"
import { CampanhasService } from "../services/CampanhasService"
import { toast } from "sonner"

const detailSheetCampanhasService = new CampanhasService()

type CampaignAnalyticsTarget = {
  id: string
  name: string
  errorMessage?: string | null
  defaultTab?: "metrics" | "logs"
}

function audienceLabel(campaign: {
  contactList: { name: string } | null
  radarSegmentSlug?: string | null
}): string {
  if (campaign.radarSegmentSlug) return `Segmento Radar: ${campaign.radarSegmentSlug}`
  if (campaign.contactList?.name) return campaign.contactList.name
  return "—"
}

function SubCampaignDispatchButton({
  subCampaign,
  sendingId,
  handleSend,
}: {
  subCampaign: SubCampaignSummary
  sendingId: string | null
  handleSend: (id: string, options?: { retryFailedOnly?: boolean }) => Promise<void>
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const isSendingThis = sendingId === subCampaign.id
  const isFailedRetry = isCampaignFailedRetry(subCampaign)
  const failedRetryCount =
    subCampaign.failedRetryRecipientCount ??
    Math.max(0, subCampaign.totalRecipients - subCampaign.totalSent)
  const actionLabel = isFailedRetry
    ? "Reenviar apenas falhas"
    : "Disparar"
  const pendingLabel = isFailedRetry
    ? "Reenviando falhas..."
    : "Disparando..."
  const dispatchCountdown = useCampaignDispatchCountdown({
    isFailedRetry,
    onDispatched: () => {
      setSendConfirmOpen(false)
      void handleSend(subCampaign.id, campaignDispatchSendOptions(subCampaign))
    },
  })

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          isSendingThis ||
          dispatchCountdown.locked ||
          (isFailedRetry && failedRetryCount <= 0)
        }
        onClick={() => setSendConfirmOpen(true)}
      >
        {isSendingThis ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Send data-icon="inline-start" />
        )}
        {isSendingThis ? pendingLabel : actionLabel}
      </Button>

      <AlertDialog
        open={sendConfirmOpen}
        onOpenChange={(open) => {
          if (dispatchCountdown.locked && !open) return
          setSendConfirmOpen(open)
          if (!open) dispatchCountdown.reset()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFailedRetry
                ? "Reenviar apenas as falhas?"
                : "Confirmar disparo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFailedRetry ? (
                <>
                  A sub-campanha <strong>&quot;{subCampaign.name}&quot;</strong> será reenviada
                  apenas para{" "}
                  <strong>{failedRetryCount.toLocaleString("pt-BR")}</strong> destinatário(s) que
                  falharam. Quem já recebeu <strong>não</strong> será reenviado. Os créditos
                  correspondentes serão deduzidos só desse reenvio.
                </>
              ) : (
                <>
                  A campanha <strong>&quot;{subCampaign.name}&quot;</strong> será enviada para{" "}
                  <strong>{subCampaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
                  destinatário(s) ativo(s). Os créditos correspondentes serão
                  deduzidos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dispatchCountdown.locked}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                dispatchCountdown.start()
              }}
              disabled={!dispatchCountdown.locked && isFailedRetry && failedRetryCount <= 0}
              aria-busy={dispatchCountdown.locked}
            >
              <CampaignDispatchCountdownButtonLabel
                locked={dispatchCountdown.locked}
                countdownLabel={dispatchCountdown.label}
                showLoader={dispatchCountdown.showLoader}
                idleLabel={
                  isFailedRetry ? "Sim, reenviar apenas falhas" : "Sim, disparar"
                }
              />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SubCampaignActionsMenu({
  subCampaign,
  canSendCampaign,
  sendBlockReason,
  sendingId,
  openViewById,
  openEditById,
  handleSend,
  onOpenAnalytics,
}: {
  subCampaign: SubCampaignSummary
  canSendCampaign: boolean
  sendBlockReason?: string
  sendingId: string | null
  openViewById: (id: string) => Promise<void>
  openEditById: (id: string) => Promise<void>
  handleSend: (id: string, options?: { retryFailedOnly?: boolean }) => Promise<void>
  onOpenAnalytics: (campaign: CampaignAnalyticsTarget) => void
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const canEdit = ["draft", "scheduled"].includes(subCampaign.status)
  const canRetryByStatus =
    subCampaign.status === "failed" ||
    subCampaign.status === "partially_sent" ||
    subCampaign.status === "sent"
  const isFailedRetry = isCampaignFailedRetry(subCampaign)
  const actionLabel = isFailedRetry
    ? "Reenviar apenas falhas"
    : "Disparar"
  const pendingLabel = isFailedRetry
    ? "Reenviando falhas..."
    : "Disparando..."
  const isSendingThis = sendingId === subCampaign.id
  const canRetry =
    canRetryByStatus && canSendCampaign && !sendBlockReason && !isSendingThis
  const failedRetryCount =
    subCampaign.failedRetryRecipientCount ??
    Math.max(0, subCampaign.totalRecipients - subCampaign.totalSent)
  const retryDisabledReason =
    sendBlockReason ??
    (!canRetryByStatus
      ? "Disparo disponível apenas para sub-campanhas enviadas ou com falha"
      : !canSendCampaign
        ? "Ative um plano em Assinaturas para disparar campanhas"
        : undefined)
  const dispatchCountdown = useCampaignDispatchCountdown({
    isFailedRetry,
    onDispatched: () => {
      setSendConfirmOpen(false)
      void handleSend(subCampaign.id, campaignDispatchSendOptions(subCampaign))
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <span className="sr-only">Abrir ações da sub-campanha</span>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void openViewById(subCampaign.id)}>
            <Eye />
            Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void openEditById(subCampaign.id)} disabled={!canEdit}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              onOpenAnalytics({
                id: subCampaign.id,
                name: subCampaign.name,
                errorMessage: subCampaign.errorMessage ?? null,
              })
            }
          >
            <BarChart3 />
            Métricas
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              onOpenAnalytics({
                id: subCampaign.id,
                name: subCampaign.name,
                errorMessage: subCampaign.errorMessage ?? null,
                defaultTab: "logs",
              })
            }
          >
            <ScrollText />
            Ver logs
          </DropdownMenuItem>
          {canRetryByStatus && retryDisabledReason && !canRetry ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <DropdownMenuItem disabled className="pointer-events-none w-full">
                    {isSendingThis ? <Loader2 className="animate-spin" /> : <Send />}
                    {isSendingThis ? pendingLabel : actionLabel}
                  </DropdownMenuItem>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">{retryDisabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              onClick={() => setSendConfirmOpen(true)}
              disabled={!canRetry || (isFailedRetry && failedRetryCount <= 0)}
            >
              {isSendingThis ? <Loader2 className="animate-spin" /> : <Send />}
              {isSendingThis ? pendingLabel : actionLabel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={sendConfirmOpen}
        onOpenChange={(open) => {
          if (dispatchCountdown.locked && !open) return
          setSendConfirmOpen(open)
          if (!open) dispatchCountdown.reset()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFailedRetry
                ? "Reenviar apenas as falhas?"
                : "Confirmar disparo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isFailedRetry ? (
                <>
                  A sub-campanha <strong>&quot;{subCampaign.name}&quot;</strong> será reenviada
                  apenas para{" "}
                  <strong>{failedRetryCount.toLocaleString("pt-BR")}</strong> destinatário(s) que
                  falharam. Quem já recebeu <strong>não</strong> será reenviado. Os créditos
                  correspondentes serão deduzidos só desse reenvio.
                </>
              ) : (
                <>
                  A campanha <strong>&quot;{subCampaign.name}&quot;</strong> será enviada para{" "}
                  <strong>{subCampaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
                  destinatário(s) ativo(s). Os créditos correspondentes serão
                  deduzidos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dispatchCountdown.locked}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                dispatchCountdown.start()
              }}
              disabled={!dispatchCountdown.locked && isFailedRetry && failedRetryCount <= 0}
              aria-busy={dispatchCountdown.locked}
            >
              <CampaignDispatchCountdownButtonLabel
                locked={dispatchCountdown.locked}
                countdownLabel={dispatchCountdown.label}
                showLoader={dispatchCountdown.showLoader}
                idleLabel={
                  isFailedRetry ? "Sim, reenviar apenas falhas" : "Sim, disparar"
                }
              />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CampaignDetailSheet({
  onOpenAnalytics,
}: {
  onOpenAnalytics: (campaign: CampaignAnalyticsTarget) => void
}) {
  const { tz } = useTimezone()
  const { host, readOnly, skipBetaGate, teamId } = useStudioEmailRuntime()
  const params = useParams<{ supabaseId?: string }>()
  const supabaseId = params.supabaseId
  const {
    detailCampaign,
    closeDetail,
    sendingId,
    cancelingId,
    credits,
    openEditWizard,
    openDuplicateWizard,
    openViewById,
    openEditById,
    handleSend,
    handleCancel,
  } = useCampanhasContext()
  const [leafSendConfirmOpen, setLeafSendConfirmOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [generateSegmentOpen, setGenerateSegmentOpen] = useState(false)
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false)
  const [templatePreviewLoading, setTemplatePreviewLoading] = useState(false)
  const [templatePreview, setTemplatePreview] = useState<DispatchPreviewData | null>(null)
  const leafDispatchCountdown = useCampaignDispatchCountdown({
    isFailedRetry: Boolean(detailCampaign && isCampaignFailedRetry(detailCampaign)),
    onDispatched: () => {
      if (!detailCampaign) return
      setLeafSendConfirmOpen(false)
      void handleSend(detailCampaign.id, campaignDispatchSendOptions(detailCampaign))
    },
  })
  // Plan gate: credits.isBetaExempt (API resolveEmailBetaAccess) or host skipBetaGate — not showsBetaLabel.
  const canSendCampaign =
    !!credits?.hasSubscription || skipBetaGate || !!credits?.isBetaExempt

  const radarHref =
    supabaseId && detailCampaign && !host
      ? `/${supabaseId}/radar?tab=segmentos&segment=${encodeURIComponent(buildCampaignRadarSegmentSlug(detailCampaign.id))}`
      : null

  const isParentCampaign = Boolean(
    detailCampaign?.isParentCampaign || (detailCampaign?.subCampaignCount ?? 0) > 0
  )
  const parentCampaignId = detailCampaign?.parentCampaignId ?? null
  const canEdit =
    detailCampaign != null && ["draft", "scheduled"].includes(detailCampaign.status)
  const templateId = detailCampaign?.template?.id ?? detailCampaign?.templateId ?? null
  const templateName = detailCampaign?.template?.name ?? "—"

  async function handlePreviewTemplate() {
    if (!supabaseId || !templateId) return
    setTemplatePreviewLoading(true)
    setTemplatePreviewOpen(true)
    try {
      const template = await detailSheetCampanhasService.getTemplateById(
        supabaseId,
        teamId,
        templateId
      )
      setTemplatePreview({
        subject: template.subject,
        html: template.html?.trim() ? template.html : "",
        templateVersionNumber: template.versionNumber ?? 1,
        templateName: template.name,
      })
    } catch (err) {
      console.error("[CampaignDetailSheet] previewTemplate error", err)
      toast.error("Erro ao carregar prévia do template")
      setTemplatePreviewOpen(false)
      setTemplatePreview(null)
    } finally {
      setTemplatePreviewLoading(false)
    }
  }

  const canCancel =
    detailCampaign &&
    !isParentCampaign &&
    (detailCampaign.status === "scheduled" || detailCampaign.status === "sending")
  const canSendByStatus =
    !isParentCampaign &&
    detailCampaign != null &&
    (detailCampaign.status === "draft" ||
      detailCampaign.status === "scheduled" ||
      detailCampaign.status === "sent" ||
      detailCampaign.status === "failed" ||
      detailCampaign.status === "partially_sent")
  const isLeafFailedRetry = Boolean(
    detailCampaign && isCampaignFailedRetry(detailCampaign)
  )
  const leafFailedRetryCount =
    detailCampaign?.failedRetryRecipientCount ??
    (detailCampaign
      ? Math.max(0, detailCampaign.totalRecipients - detailCampaign.totalSent)
      : 0)
  const leafSendActionLabel = isLeafFailedRetry ? "Redisparar falhas" : "Disparar"
  const leafSendBlockReason = detailCampaign
    ? getCampaignSendBlockReason({
        campaign: detailCampaign,
        credits,
        bypassPlanGate: skipBetaGate,
      })
    : undefined
  const canSendLeaf =
    !readOnly &&
    canSendByStatus &&
    canSendCampaign &&
    !leafSendBlockReason &&
    sendingId !== detailCampaign?.id &&
    !(isLeafFailedRetry && leafFailedRetryCount <= 0)
  const detailErrorMessage = formatCampaignDispatchErrorMessage(
    detailCampaign?.errorMessage
  )
  const detailProgress = detailCampaign
    ? resolveCampaignDispatchProgressDisplay(detailCampaign)
    : null
  const detailProgressForDisplay =
    detailProgress == null
      ? detailProgress
      : {
          ...detailProgress,
          errorMessage: formatCampaignDispatchErrorMessage(detailProgress.errorMessage),
        }

  function getSendBlockReason(subCampaign: SubCampaignSummary): string | undefined {
    return getCampaignSendBlockReason({
      campaign: subCampaign,
      credits,
      bypassPlanGate: skipBetaGate,
    })
  }

  async function handleCancelConfirm() {
    if (!detailCampaign) return
    await handleCancel(detailCampaign.id)
    setCancelConfirmOpen(false)
  }

  return (
    <Sheet
      open={Boolean(detailCampaign)}
      onOpenChange={(open) => {
        if (!open) closeDetail()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-5xl">
        <SheetHeader className="gap-3 border-b pb-4">
          <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <SheetTitle>{detailCampaign?.name ?? "Campanha"}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {detailCampaign ? <CampaignStatusBadge status={detailCampaign.status} /> : null}
                {isParentCampaign && detailCampaign?.status === "partially_sent" &&
                 detailCampaign.partiallySentCount != null &&
                 detailCampaign.partiallySentTotal != null ? (
                  <Badge variant="outline" className="border-semantic-warning-border text-semantic-warning">
                    {detailCampaign.partiallySentCount} de {detailCampaign.partiallySentTotal} partes enviadas
                  </Badge>
                ) : isParentCampaign ? (
                  <Badge variant="secondary">
                    {detailCampaign?.subCampaignCount ?? detailCampaign?.subCampaigns?.length ?? 0}{" "}
                    partes
                  </Badge>
                ) : null}
                <span>Campanha atual.</span>
              </SheetDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {parentCampaignId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openViewById(parentCampaignId)}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Voltar à campanha pai
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={closeDetail}>
                Fechar
              </Button>
            </div>
          </div>
          {detailCampaign ? (
            <CampaignDispatchProgressLine
              progress={detailProgressForDisplay}
              className="max-w-md"
            />
          ) : null}
        </SheetHeader>

        {detailCampaign ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Criado por</span>
                    <span className="font-medium">
                      {formatEmailCreatorLabel(detailCampaign)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Destinatários</span>
                    <span className="font-medium">
                      {detailCampaign.totalRecipients.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Qtd. disparos</span>
                    <span className="font-medium">
                      {detailCampaign.dispatchCount.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Último disparo</span>
                    <span className="font-medium">
                      {detailCampaign.sentAt
                        ? formatIntimezone(new Date(detailCampaign.sentAt), "dd/MM/yyyy HH:mm", tz)
                        : "—"}
                    </span>
                  </div>
                </div>

                {detailErrorMessage ? (
                  <div className="mb-4 flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Mensagem de erro</span>
                    <span className="text-destructive">{detailErrorMessage}</span>
                  </div>
                ) : null}

                {isParentCampaign && detailCampaign.subCampaigns && detailCampaign.subCampaigns.length > 0 ? (
                  <div className="mb-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Partes da campanha</p>
                      {detailCampaign.status === "failed" ||
                      detailCampaign.status === "partially_sent" ? (
                        <span className="text-xs text-semantic-warning">
                          {
                            detailCampaign.subCampaigns.filter((sub) => sub.status === "failed")
                              .length
                          }{" "}
                          parte(s) com falha —{" "}
                          {detailCampaign.subCampaigns.some(isCampaignFailedRetry)
                            ? 'use "Reenviar apenas falhas" nas ações de cada parte (somente quem falhou; quem já recebeu não é reenviado)'
                            : 'use "Disparar" nas ações de cada parte'}
                        </span>
                      ) : null}
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <Table className="min-w-[760px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parte</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Agendamento</TableHead>
                            <TableHead className="text-right">Destinatários</TableHead>
                            <TableHead>Erro</TableHead>
                            <TableHead className="w-12 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailCampaign.subCampaigns.map((sub) => {
                            const subSendBlockReason = getSendBlockReason(sub)
                            const canShowResend =
                              sub.status === "failed" ||
                              sub.status === "partially_sent" ||
                              sub.status === "sent"
                            const canResendNow =
                              canShowResend && canSendCampaign && !subSendBlockReason && !readOnly
                            const subErrorMessage = formatCampaignDispatchErrorMessage(
                              sub.errorMessage
                            )
                            const subProgress = sub.activeDispatch ?? sub.latestDispatch ?? null
                            const childActionLabel = isCampaignFailedRetry(sub)
                              ? "Reenviar apenas falhas"
                              : "Disparar"

                            return (
                            <TableRow key={sub.id} className={cn(sub.status === "failed" && "bg-semantic-danger-surface/30")}>
                              <TableCell className="font-medium">
                                {sub.subCampaignIndex ?? "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <CampaignStatusBadge status={sub.status} scheduledAt={sub.scheduledAt} />
                                  <CampaignDispatchProgressLine
                                    progress={
                                      subProgress
                                        ? {
                                            ...subProgress,
                                            errorMessage: formatCampaignDispatchErrorMessage(
                                              subProgress.errorMessage
                                            ),
                                          }
                                        : null
                                    }
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {sub.scheduledAt
                                  ? formatIntimezone(new Date(sub.scheduledAt), "dd/MM/yyyy HH:mm", tz)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {sub.totalRecipients.toLocaleString("pt-BR")}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                {sub.status === "failed" && subErrorMessage ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="line-clamp-2 cursor-default text-xs text-semantic-danger">
                                        {subErrorMessage}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">{subErrorMessage}</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {canShowResend ? (
                                    canResendNow ? (
                                      <SubCampaignDispatchButton
                                        subCampaign={sub}
                                        sendingId={sendingId}
                                        handleSend={handleSend}
                                      />
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              disabled
                                            >
                                              <Send data-icon="inline-start" />
                                              {childActionLabel}
                                            </Button>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm">
                                          {subSendBlockReason ??
                                            "Ative um plano em Assinaturas para disparar campanhas"}
                                        </TooltipContent>
                                      </Tooltip>
                                    )
                                  ) : null}
                                  <SubCampaignActionsMenu
                                    subCampaign={sub}
                                    canSendCampaign={canSendCampaign}
                                    sendBlockReason={subSendBlockReason}
                                    sendingId={sendingId}
                                    openViewById={openViewById}
                                    openEditById={openEditById}
                                    handleSend={handleSend}
                                    onOpenAnalytics={onOpenAnalytics}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                <Separator className="mb-4" />

                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium">Detalhes da campanha</span>
                    {!readOnly ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label="Mais ações"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => void openDuplicateWizard(detailCampaign)}
                          >
                            <Copy />
                            Duplicar
                          </DropdownMenuItem>
                          {canEdit ? (
                            <DropdownMenuItem
                              onClick={() => void openEditWizard(detailCampaign)}
                            >
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                          ) : null}
                          {canSendByStatus ? (
                            canSendLeaf ? (
                              <DropdownMenuItem
                                onClick={() => setLeafSendConfirmOpen(true)}
                              >
                                <Send />
                                {leafSendActionLabel}
                              </DropdownMenuItem>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="w-full">
                                    <DropdownMenuItem
                                      disabled
                                      className="pointer-events-none w-full"
                                    >
                                      <Send />
                                      {leafSendActionLabel}
                                    </DropdownMenuItem>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  {leafSendBlockReason ??
                                    "Ative um plano em Assinaturas para disparar campanhas"}
                                </TooltipContent>
                              </Tooltip>
                            )
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Nome</span>
                      <span className="font-medium">{detailCampaign.name}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Template</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{templateName}</span>
                        {templateId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handlePreviewTemplate()}
                            disabled={templatePreviewLoading}
                          >
                            {templatePreviewLoading ? (
                              <Loader2 data-icon="inline-start" className="animate-spin" />
                            ) : (
                              <Eye data-icon="inline-start" />
                            )}
                            Visualizar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Lista / audiência</span>
                      <span className="font-medium">{audienceLabel(detailCampaign)}</span>
                    </div>
                    {detailCampaign.linkedForm ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Formulário vinculado</span>
                        <span className="font-medium">{detailCampaign.linkedForm.name}</span>
                      </div>
                    ) : null}
                    {!isParentCampaign && detailCampaign.scheduledAt ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Agendamento</span>
                        <span className="font-medium">
                          {formatIntimezone(
                            new Date(detailCampaign.scheduledAt),
                            "dd/MM/yyyy HH:mm",
                            tz
                          )}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap sm:justify-end">
                {canCancel && !readOnly ? (
                  <Button
                    variant="destructive"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={cancelingId === detailCampaign.id}
                  >
                    <CalendarX data-icon="inline-start" />
                    {cancelingId === detailCampaign.id
                      ? "Cancelando..."
                      : detailCampaign.status === "sending"
                        ? "Cancelar envio"
                        : "Cancelar agendamento"}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  onClick={() =>
                    onOpenAnalytics({
                      id: detailCampaign.id,
                      name: detailCampaign.name,
                      errorMessage: detailCampaign.errorMessage ?? null,
                      defaultTab: "logs",
                    })
                  }
                >
                  <ScrollText data-icon="inline-start" />
                  Logs
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    onOpenAnalytics({
                      id: detailCampaign.id,
                      name: detailCampaign.name,
                      errorMessage: detailCampaign.errorMessage ?? null,
                    })
                  }
                >
                  <BarChart3 data-icon="inline-start" />
                  Analytics
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setGenerateSegmentOpen(true)}
                >
                  <GitBranch data-icon="inline-start" />
                  Gerar segmento
                </Button>
                {radarHref ? (
                  <Button variant="outline" asChild>
                    <Link href={radarHref}>
                      <Radar data-icon="inline-start" />
                      Ver no Radar
                    </Link>
                  </Button>
                ) : null}
              </SheetFooter>

              <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {detailCampaign.status === "sending" ? "Cancelar envio?" : "Cancelar agendamento?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {detailCampaign.status === "sending" ? (
                        <>
                          O envio da campanha <strong>&quot;{detailCampaign.name}&quot;</strong> será
                          interrompido. {CAMPAIGN_CANCEL_SENDING_UNSENT_COPY}{" "}
                          {CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY}
                        </>
                      ) : (
                        <>
                          A campanha <strong>"{detailCampaign.name}"</strong> voltará para rascunho e não será
                          disparada no horário agendado.
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelingId === detailCampaign.id}>
                      {detailCampaign.status === "sending" ? "Continuar enviando" : "Manter agendamento"}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        void handleCancelConfirm()
                      }}
                      disabled={cancelingId === detailCampaign.id}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelingId === detailCampaign.id ? "Cancelando..." : "Sim, cancelar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog
                open={leafSendConfirmOpen}
                onOpenChange={(open) => {
                  if (leafDispatchCountdown.locked && !open) return
                  setLeafSendConfirmOpen(open)
                  if (!open) leafDispatchCountdown.reset()
                }}
              >
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
                          A campanha <strong>&quot;{detailCampaign.name}&quot;</strong> será
                          reenviada apenas para{" "}
                          <strong>{leafFailedRetryCount.toLocaleString("pt-BR")}</strong>{" "}
                          destinatário(s) que falharam. Quem já recebeu <strong>não</strong> será
                          reenviado. Os créditos correspondentes serão deduzidos só desse reenvio.
                        </>
                      ) : (
                        <>
                          A campanha <strong>&quot;{detailCampaign.name}&quot;</strong> será
                          enviada para{" "}
                          <strong>
                            {detailCampaign.totalRecipients.toLocaleString("pt-BR")}
                          </strong>{" "}
                          destinatário(s) ativo(s). Os créditos correspondentes serão
                          deduzidos.
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={leafDispatchCountdown.locked}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        leafDispatchCountdown.start()
                      }}
                      disabled={
                        !leafDispatchCountdown.locked &&
                        isLeafFailedRetry &&
                        leafFailedRetryCount <= 0
                      }
                      aria-busy={leafDispatchCountdown.locked}
                    >
                      <CampaignDispatchCountdownButtonLabel
                        locked={leafDispatchCountdown.locked}
                        countdownLabel={leafDispatchCountdown.label}
                        showLoader={leafDispatchCountdown.showLoader}
                        idleLabel={
                          isLeafFailedRetry
                            ? "Sim, reenviar apenas falhas"
                            : "Sim, disparar"
                        }
                      />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <GenerateSegmentDialog
                open={generateSegmentOpen}
                onOpenChange={setGenerateSegmentOpen}
                sourceType="campaign"
                sourceName={detailCampaign.name}
                campaignId={detailCampaign.id}
              />

              <DispatchEmailPreviewDialog
                open={templatePreviewOpen}
                onOpenChange={(open) => {
                  setTemplatePreviewOpen(open)
                  if (!open) setTemplatePreview(null)
                }}
                preview={templatePreview}
              />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
