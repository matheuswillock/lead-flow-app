"use client"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { CampaignLogsTab } from "./CampaignLogsTab"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import type { ContactList, CampaignSheetTab } from "../context/CampanhasTypes"

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

export function CampaignDetailSheet() {
  const { tz } = useTimezone()
  const {
    detailCampaign,
    sheetTab,
    setSheetTab,
    closeDetail,
    editName,
    editTemplateId,
    editContactListId,
    editScheduledAt,
    editSaving,
    templates,
    contactLists,
    setEditName,
    setEditTemplateId,
    setEditContactListId,
    setEditScheduledAt,
    handleUpdateCampaign,
  } = useCampanhasContext()

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

  return (
    <Sheet
      open={Boolean(detailCampaign)}
      onOpenChange={(open) => {
        if (!open) closeDetail()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
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
            <span>Campanha atual e logs de disparo.</span>
          </SheetDescription>
        </SheetHeader>

        {detailCampaign ? (
          <Tabs
            value={sheetTab}
            onValueChange={(value) => setSheetTab(value as CampaignSheetTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mx-0 mt-4 w-full justify-start">
              <TabsTrigger value="campaign">Campanha atual</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="campaign" className="mt-4 flex min-h-0 flex-1 flex-col">
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
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parte</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Agendamento</TableHead>
                            <TableHead className="text-right">Destinatários</TableHead>
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
                        Alterações de template e lista valem para o próximo disparo. O histórico
                        dos disparos anteriores permanece intacto.
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
            </TabsContent>

            <TabsContent value="logs" className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <CampaignLogsTab campaignId={detailCampaign.id} />
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
