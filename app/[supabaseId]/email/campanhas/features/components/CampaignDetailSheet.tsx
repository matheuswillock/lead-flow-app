"use client"

import { useState } from "react"
import { BarChart3, Loader2, MoreHorizontal, Pencil, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
import type { ContactList, SubCampaignSummary } from "../context/CampanhasTypes"

type CampaignAnalyticsTarget = {
  id: string
  name: string
  errorMessage?: string | null
}

function formatContactListLabel(list: ContactList): string {
  const activeCount = list.activeContacts ?? list.totalContacts
  return `${list.name} (${activeCount.toLocaleString("pt-BR")} ativos)`
}

function audienceLabel(campaign: {
  contactList: { name: string } | null
  cdpSegmentSlug?: string | null
}): string {
  if (campaign.cdpSegmentSlug) return `Segmento CDP: ${campaign.cdpSegmentSlug}`
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
  const canEdit = ["draft", "scheduled", "sent", "failed"].includes(subCampaign.status)
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
            Métricas e logs
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
    editName,
    editTemplateId,
    editContactListId,
    editScheduledAt,
    editSaving,
    sendingId,
    credits,
    templates,
    contactLists,
    setEditName,
    setEditTemplateId,
    setEditContactListId,
    setEditScheduledAt,
    handleUpdateCampaign,
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
    ["draft", "scheduled", "sent", "failed"].includes(detailCampaign.status)
  const canSchedule =
    detailCampaign &&
    !isParentCampaign &&
    (detailCampaign.status === "draft" || detailCampaign.status === "scheduled")
  const isSubCampaign = Boolean(
    detailCampaign?.parentCampaignId || (detailCampaign?.audienceContactIds?.length ?? 0) > 0
  )

  function getSendBlockReason(subCampaign: SubCampaignSummary): string | undefined {
    if (isCampaignsBetaAccess || credits?.isBetaExempt) return undefined
    if (!credits?.hasSubscription) {
      return "Ative um plano em Assinaturas para disparar campanhas"
    }
    if (credits.creditsAvailable < subCampaign.totalRecipients) {
      return `Créditos insuficientes para ${subCampaign.totalRecipients.toLocaleString("pt-BR")} destinatários. Saldo: ${credits.creditsAvailable.toLocaleString("pt-BR")}`
    }
    return undefined
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
            {isParentCampaign ? (
              <Badge variant="secondary">
                {detailCampaign?.subCampaignCount ?? detailCampaign?.subCampaigns?.length ?? 0}{" "}
                sub-campanhas
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
                      {detailCampaign.creator?.fullName || detailCampaign.creator?.email || "—"}
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
                    <p className="text-sm font-medium">Sub-campanhas</p>
                    <div className="overflow-x-auto rounded-md border">
                      <Table className="min-w-[760px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parte</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Agendamento</TableHead>
                            <TableHead className="text-right">Destinatários</TableHead>
                            <TableHead className="w-12 text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailCampaign.subCampaigns.map((sub) => (
                            <TableRow key={sub.id}>
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

                {canEdit ? (
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="campaign-edit-name">Nome da campanha *</FieldLabel>
                      <Input
                        id="campaign-edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={editSaving}
                        placeholder="Ex: Newsletter Junho 2026"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Template</FieldLabel>
                      <Select
                        value={editTemplateId}
                        onValueChange={setEditTemplateId}
                        disabled={editSaving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {!isSubCampaign ? (
                      <Field>
                        <FieldLabel>Lista de contatos</FieldLabel>
                        <Select
                          value={editContactListId}
                          onValueChange={setEditContactListId}
                          disabled={editSaving}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma lista..." />
                          </SelectTrigger>
                          <SelectContent>
                            {contactLists.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {formatContactListLabel(l)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel>Lista / audiência</FieldLabel>
                        <Input value={audienceLabel(detailCampaign)} disabled />
                        <p className="text-xs text-muted-foreground">
                          A audiência da sub-campanha fica bloqueada para preservar o lote
                          original de destinatários.
                        </p>
                      </Field>
                    )}
                    {canSchedule ? (
                      <Field>
                        <DateTimePicker
                          date={editScheduledAt}
                          onDateChange={setEditScheduledAt}
                          label="Agendar envio (opcional)"
                          disabled={editSaving}
                          disablePastDates
                          tz={tz}
                        />
                        {editScheduledAt ? (
                          <button
                            type="button"
                            onClick={() => setEditScheduledAt(undefined)}
                            className="text-xs text-muted-foreground underline underline-offset-2"
                          >
                            Remover agendamento
                          </button>
                        ) : null}
                      </Field>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {isSubCampaign
                          ? "Alterações de nome e template valem para o próximo disparo. O histórico dos disparos anteriores permanece intacto."
                          : "Alterações de template e lista valem para o próximo disparo. O histórico dos disparos anteriores permanece intacto."}
                      </p>
                    )}
                  </FieldGroup>
                ) : (
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
                    <p className="col-span-full text-sm text-muted-foreground">
                      {isParentCampaign
                        ? "Campanha-pai é somente leitura. As sub-campanhas seguem o agendamento criado no dia 0."
                        : "Esta campanha não pode ser editada no status atual."}
                    </p>
                  </div>
                )}
              </div>

              {canEdit ? (
                <SheetFooter className="mt-4 border-t pt-4">
                  <Button variant="outline" onClick={closeDetail} disabled={editSaving}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => void handleUpdateCampaign()}
                    disabled={editSaving || !editName.trim()}
                  >
                    {editSaving ? "Salvando..." : "Salvar"}
                  </Button>
                </SheetFooter>
              ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
