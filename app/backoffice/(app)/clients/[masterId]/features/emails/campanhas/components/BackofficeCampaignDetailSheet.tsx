"use client"

import { Loader2 } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { CampaignStatusBadge } from "@/components/email/CampaignStatusBadge"
import { formatEmailCreatorLabel } from "@/lib/email/format-email-creator"
import { DEFAULT_TZ, formatIntimezone } from "@/lib/dates"
import type { UseBackofficeCampanhasReturn } from "../hooks/useBackofficeCampanhas"

type Props = Pick<
  UseBackofficeCampanhasReturn,
  | "detailCampaign"
  | "detailLoading"
  | "editName"
  | "editTemplateId"
  | "editContactListId"
  | "editSaving"
  | "templates"
  | "contactLists"
  | "closeDetail"
  | "setEditName"
  | "setEditTemplateId"
  | "setEditContactListId"
  | "handleUpdateCampaign"
  | "canManage"
> & {
  onOpenAnalytics: () => void
}

export function BackofficeCampaignDetailSheet({
  detailCampaign,
  detailLoading,
  editName,
  editTemplateId,
  editContactListId,
  editSaving,
  templates,
  contactLists,
  closeDetail,
  setEditName,
  setEditTemplateId,
  setEditContactListId,
  handleUpdateCampaign,
  canManage,
  onOpenAnalytics,
}: Props) {
  const canEdit =
    detailCampaign &&
    canManage &&
    ["draft", "scheduled", "sent", "failed"].includes(detailCampaign.status)

  return (
    <Sheet
      open={Boolean(detailCampaign)}
      onOpenChange={(open) => {
        if (!open) closeDetail()
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader className="gap-1 border-b pb-4">
          <SheetTitle className="pr-8">{detailCampaign?.name ?? "Campanha"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            {detailCampaign ? (
              <CampaignStatusBadge
                status={detailCampaign.status}
                scheduledAt={detailCampaign.scheduledAt}
              />
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {detailCampaign ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Carregando...
                </div>
              ) : (
                <>
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
                      <span className="text-muted-foreground">Criado em</span>
                      <span className="font-medium">
                        {formatIntimezone(
                          new Date(detailCampaign.createdAt),
                          "dd/MM/yyyy HH:mm",
                          DEFAULT_TZ
                        )}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">Último disparo</span>
                      <span className="font-medium">
                        {detailCampaign.sentAt
                          ? formatIntimezone(
                              new Date(detailCampaign.sentAt),
                              "dd/MM/yyyy HH:mm",
                              DEFAULT_TZ
                            )
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
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
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
                            {contactLists.map((list) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                  ) : (
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Template</span>
                        <span className="font-medium">{detailCampaign.template?.name ?? "—"}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Lista</span>
                        <span className="font-medium">
                          {detailCampaign.contactList?.name ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <SheetFooter className="mt-4 gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={onOpenAnalytics}>
                Métricas
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  onClick={() => void handleUpdateCampaign()}
                  disabled={editSaving || !editName.trim()}
                >
                  {editSaving ? "Salvando..." : "Salvar alterações"}
                </Button>
              ) : null}
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
