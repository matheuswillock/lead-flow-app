"use client"

import { useState } from "react"
import { BarChart3, Loader2, MoreHorizontal, Pencil, Send, ScrollText } from "lucide-react"
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
  handleSend: (id: string) => Promise<void>
  onOpenAnalytics: (campaign: CampaignAnalyticsTarget) => void
}) {
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const canEdit = ["draft", "scheduled"].includes(subCampaign.status)
  const canRetryByStatus = subCampaign.status === "failed"
  const canRetry =
    canRetryByStatus && canSendCampaign && !sendBlockReason && sendingId !== subCampaign.id
  const retryDisabledReason =
    sendBlockReason ??
    (!canRetryByStatus
      ? "Reenvio disponível apenas para sub-campanhas com falha"
      : !canSendCampaign
        ? "Ative um plano em Assinaturas para disparar campanhas"
        : undefined)

  async function handleSendConfirm() {
    setSending(true)
    try {
      await handleSend(subCampaign.id)
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
          <DropdownMenuItem
            onClick={() => setSendConfirmOpen(true)}
            disabled={!canRetry}
            title={!canRetry ? retryDisabledReason : undefined}
          >
            {sendingId === subCampaign.id ? <Loader2 className="animate-spin" /> : <Send />}
            {sendingId === subCampaign.id ? "Reenviando..." : "Reenviar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reenviar sub-campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              A sub-campanha <strong>"{subCampaign.name}"</strong> será reenviada para{" "}
              <strong>{subCampaign.totalRecipients.toLocaleString("pt-BR")}</strong>{" "}
              destinatário(s). Os créditos correspondentes serão deduzidos novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleSendConfirm()
              }}
              disabled={sending}
            >
              {sending ? "Reenviando..." : "Sim, reenviar"}
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
  const {
    detailCampaign,
    closeDetail,
    sendingId,
    credits,
    openEditWizard,
    openEditById,
    handleSend,
  } = useCampanhasContext()
  const isCampaignsBetaAccess = isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const canSendCampaign =
    !!credits?.hasSubscription || isCampaignsBetaAccess || !!credits?.isBetaExempt

  const isParentCampaign = Boolean(
    detailCampaign?.isParentCampaign || (detailCampaign?.subCampaignCount ?? 0) > 0
  )
  const canEdit =
    detailCampaign &&
    !isParentCampaign &&
    ["draft", "scheduled", "sent", "failed", "partially_sent"].includes(detailCampaign.status)
  function getSendBlockReason(subCampaign: SubCampaignSummary): string | undefined {
    return getCampaignSendBlockReason({
      campaign: subCampaign,
      credits,
      isCampaignsBetaAccess,
    })
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
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Partes da campanha</p>
                      {detailCampaign.status === "partially_sent" ? (
                        <span className="text-xs text-semantic-warning">
                          {detailCampaign.subCampaigns.filter((sub) => sub.status === "failed").length} parte(s) com falha — use "Reenviar" para retentar
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
                          {detailCampaign.subCampaigns.map((sub) => (
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
                                <SubCampaignActionsMenu
                                  subCampaign={sub}
                                  canSendCampaign={canSendCampaign}
                                  sendBlockReason={getSendBlockReason(sub)}
                                  sendingId={sendingId}
                                  openEditById={openEditById}
                                  handleSend={handleSend}
                                  onOpenAnalytics={onOpenAnalytics}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
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
                {canEdit ? (
                  <Button onClick={() => void openEditWizard(detailCampaign)}>
                    <Pencil data-icon="inline-start" />
                    Editar
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
              </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
