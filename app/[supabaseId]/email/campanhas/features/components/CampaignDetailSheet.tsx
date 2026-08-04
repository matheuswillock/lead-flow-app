"use client"

import { useState } from "react"
import { BarChart3, Copy, Loader2, MoreHorizontal, Pencil, Send, ScrollText } from "lucide-react"
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
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import type { SubCampaignSummary } from "../context/CampanhasTypes"
import { getCampaignSendBlockReason } from "../utils/getCampaignSendBlockReason"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime"

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
  const [sending, setSending] = useState(false)
  const isSendingThis = sendingId === subCampaign.id
  const isFailedRetry =
    subCampaign.status === "failed" || subCampaign.status === "partially_sent"
  const failedRetryCount =
    subCampaign.failedRetryRecipientCount ??
    Math.max(0, subCampaign.totalRecipients - subCampaign.totalSent)
  const actionLabel = isFailedRetry
    ? "Reenviar apenas falhas"
    : "Disparar"
  const pendingLabel = isFailedRetry
    ? "Reenviando falhas..."
    : "Disparando..."

  async function handleSendConfirm() {
    setSending(true)
    try {
      await handleSend(
        subCampaign.id,
        isFailedRetry ? { retryFailedOnly: true } : undefined
      )
    } finally {
      setSending(false)
      setSendConfirmOpen(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={
          isSendingThis ||
          sending ||
          (isFailedRetry && failedRetryCount <= 0)
        }
        onClick={() => setSendConfirmOpen(true)}
      >
        {isSendingThis || sending ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Send data-icon="inline-start" />
        )}
        {isSendingThis || sending ? pendingLabel : actionLabel}
      </Button>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFailedRetry
                ? "Reenviar apenas as falhas?"
                : "Disparar sub-campanha novamente?"}
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
                  A sub-campanha <strong>&quot;{subCampaign.name}&quot;</strong> terá um novo
                  disparo para{" "}
                  <strong>{subCampaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
                  destinatário(s). Os créditos correspondentes serão deduzidos novamente.
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
              disabled={sending || (isFailedRetry && failedRetryCount <= 0)}
            >
              {sending
                ? pendingLabel
                : isFailedRetry
                  ? "Sim, reenviar apenas falhas"
                  : "Sim, disparar"}
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
  openEditById,
  handleSend,
  onOpenAnalytics,
}: {
  subCampaign: SubCampaignSummary
  canSendCampaign: boolean
  sendBlockReason?: string
  sendingId: string | null
  openEditById: (id: string) => Promise<void>
  handleSend: (id: string, options?: { retryFailedOnly?: boolean }) => Promise<void>
  onOpenAnalytics: (campaign: CampaignAnalyticsTarget) => void
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const canEdit = ["draft", "scheduled"].includes(subCampaign.status)
  const canRetryByStatus =
    subCampaign.status === "failed" ||
    subCampaign.status === "partially_sent" ||
    subCampaign.status === "sent"
  const isFailedRetry =
    subCampaign.status === "failed" || subCampaign.status === "partially_sent"
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

  async function handleSendConfirm() {
    setSending(true)
    try {
      await handleSend(
        subCampaign.id,
        isFailedRetry ? { retryFailedOnly: true } : undefined
      )
    } finally {
      setSending(false)
      setSendConfirmOpen(false)
    }
  }

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

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isFailedRetry
                ? "Reenviar apenas as falhas?"
                : "Disparar sub-campanha novamente?"}
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
                  A sub-campanha <strong>&quot;{subCampaign.name}&quot;</strong> terá um novo
                  disparo para{" "}
                  <strong>{subCampaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
                  destinatário(s). Os créditos correspondentes serão deduzidos novamente.
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
              disabled={sending || (isFailedRetry && failedRetryCount <= 0)}
            >
              {sending
                ? pendingLabel
                : isFailedRetry
                  ? "Sim, reenviar apenas falhas"
                  : "Sim, disparar"}
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
  const { isBeta } = useFeatureAccess()
  const { readOnly } = useStudioEmailRuntime()
  const {
    detailCampaign,
    closeDetail,
    sendingId,
    credits,
    openEditWizard,
    openDuplicateWizard,
    openEditById,
    handleSend,
  } = useCampanhasContext()
  const [leafSendConfirmOpen, setLeafSendConfirmOpen] = useState(false)
  const [leafSending, setLeafSending] = useState(false)
  const isCampaignsBetaAccess = isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const canSendCampaign =
    !!credits?.hasSubscription || isCampaignsBetaAccess || !!credits?.isBetaExempt

  const isParentCampaign = Boolean(
    detailCampaign?.isParentCampaign || (detailCampaign?.subCampaignCount ?? 0) > 0
  )
  const canEdit =
    detailCampaign &&
    !isParentCampaign &&
    ["draft", "scheduled"].includes(detailCampaign.status)
  const canSendByStatus =
    !isParentCampaign &&
    detailCampaign != null &&
    (detailCampaign.status === "draft" ||
      detailCampaign.status === "scheduled" ||
      detailCampaign.status === "sent" ||
      detailCampaign.status === "failed" ||
      detailCampaign.status === "partially_sent")
  const isLeafFailedRetry =
    detailCampaign?.status === "failed" || detailCampaign?.status === "partially_sent"
  const leafFailedRetryCount =
    detailCampaign?.failedRetryRecipientCount ??
    (detailCampaign
      ? Math.max(0, detailCampaign.totalRecipients - detailCampaign.totalSent)
      : 0)
  const leafSendActionLabel = isLeafFailedRetry ? "Redisparar falhas" : "Disparar"
  const leafSendPendingLabel = isLeafFailedRetry ? "Reenviando falhas..." : "Disparando..."
  const leafSendBlockReason = detailCampaign
    ? getCampaignSendBlockReason({
        campaign: detailCampaign,
        credits,
        isCampaignsBetaAccess,
      })
    : undefined
  const canSendLeaf =
    !readOnly &&
    canSendByStatus &&
    canSendCampaign &&
    !leafSendBlockReason &&
    sendingId !== detailCampaign?.id &&
    !(isLeafFailedRetry && leafFailedRetryCount <= 0)

  function getSendBlockReason(subCampaign: SubCampaignSummary): string | undefined {
    return getCampaignSendBlockReason({
      campaign: subCampaign,
      credits,
      isCampaignsBetaAccess,
    })
  }

  async function handleLeafSendConfirm() {
    if (!detailCampaign) return
    setLeafSending(true)
    try {
      await handleSend(
        detailCampaign.id,
        isLeafFailedRetry ? { retryFailedOnly: true } : undefined
      )
    } finally {
      setLeafSending(false)
      setLeafSendConfirmOpen(false)
    }
  }

  return (
    <Sheet
      open={Boolean(detailCampaign)}
      onOpenChange={(open) => {
        if (!open) closeDetail()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-5xl">
        <SheetHeader className="gap-1 border-b pb-4">
          <SheetTitle className="pr-8">{detailCampaign?.name ?? "Campanha"}</SheetTitle>
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

                {detailCampaign.errorMessage ? (
                  <div className="mb-4 flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Mensagem de erro</span>
                    <span className="text-destructive">{detailCampaign.errorMessage}</span>
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
                          parte(s) com falha — use &quot;Reenviar apenas falhas&quot; nas ações de cada
                          parte (somente quem falhou; quem já recebeu não é reenviado)
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

                            return (
                            <TableRow key={sub.id} className={cn(sub.status === "failed" && "bg-semantic-danger-surface/30")}>
                              <TableCell className="font-medium">
                                {sub.subCampaignIndex ?? "—"}
                              </TableCell>
                              <TableCell>
                                <CampaignStatusBadge status={sub.status} scheduledAt={sub.scheduledAt} />
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
                                {sub.status === "failed" && sub.errorMessage ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="line-clamp-2 cursor-default text-xs text-semantic-danger">
                                        {sub.errorMessage}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">{sub.errorMessage}</TooltipContent>
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
                                              {sub.status === "failed" ||
                                              sub.status === "partially_sent"
                                                ? "Reenviar apenas falhas"
                                                : "Disparar"}
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

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Nome</span>
                    <span className="font-medium">{detailCampaign.name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-medium">{detailCampaign.template?.name ?? "—"}</span>
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
                        {formatIntimezone(new Date(detailCampaign.scheduledAt), "dd/MM/yyyy HH:mm", tz)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <SheetFooter className="mt-4 border-t pt-4">
                <Button variant="outline" onClick={closeDetail}>
                  Fechar
                </Button>
                {!readOnly ? (
                  <Button
                    variant="secondary"
                    onClick={() => void openDuplicateWizard(detailCampaign)}
                  >
                    <Copy data-icon="inline-start" />
                    Duplicar
                  </Button>
                ) : null}
                {canEdit && !readOnly ? (
                  <Button onClick={() => void openEditWizard(detailCampaign)}>
                    <Pencil data-icon="inline-start" />
                    Editar
                  </Button>
                ) : null}
                {canSendByStatus && !readOnly ? (
                  canSendLeaf ? (
                    <Button onClick={() => setLeafSendConfirmOpen(true)}>
                      <Send data-icon="inline-start" />
                      {leafSendActionLabel}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button disabled>
                            <Send data-icon="inline-start" />
                            {leafSendActionLabel}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        {leafSendBlockReason ??
                          "Ative um plano em Assinaturas para disparar campanhas"}
                      </TooltipContent>
                    </Tooltip>
                  )
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
              </SheetFooter>

              <AlertDialog open={leafSendConfirmOpen} onOpenChange={setLeafSendConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {isLeafFailedRetry
                        ? "Reenviar apenas as falhas?"
                        : "Disparar campanha?"}
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
                          A campanha <strong>&quot;{detailCampaign.name}&quot;</strong> terá um
                          novo disparo para{" "}
                          <strong>
                            {detailCampaign.totalRecipients.toLocaleString("pt-BR")}
                          </strong>{" "}
                          destinatário(s). Campanhas já enviadas geram um novo dispatch (não
                          alteram o histórico anterior). Os créditos correspondentes serão
                          deduzidos.
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={leafSending}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        void handleLeafSendConfirm()
                      }}
                      disabled={leafSending || (isLeafFailedRetry && leafFailedRetryCount <= 0)}
                    >
                      {leafSending
                        ? leafSendPendingLabel
                        : isLeafFailedRetry
                          ? "Sim, reenviar apenas falhas"
                          : "Sim, disparar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
