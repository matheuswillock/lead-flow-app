"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CircleHelp } from "lucide-react"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, formatLocalInputValue, parseLocalToUtc } from "@/lib/dates"
import type { ContactList } from "../context/CampanhasTypes"

function formatContactListLabel(list: ContactList): string {
  const activeCount = list.activeContacts ?? list.totalContacts
  return `${list.name} (${activeCount.toLocaleString("pt-BR")} ativos)`
}

export function CampaignCreateWizard() {
  const { tz } = useTimezone()
  const {
    wizardOpen,
    wizardStep,
    wizardName,
    wizardTemplateId,
    wizardContactListId,
    wizardRecipientSource,
    wizardCdpSegmentSlug,
    wizardScheduledAt,
    wizardCreating,
    templates,
    contactLists,
    cdpSegments,
    closeWizard,
    setWizardStep,
    setWizardName,
    setWizardTemplateId,
    setWizardContactListId,
    setWizardRecipientSource,
    setWizardCdpSegmentSlug,
    setWizardScheduledAt,
    handleCreateCampaign,
  } = useCampanhasContext()

  const minDateTime = formatLocalInputValue(new Date(), tz)
  const selectedList = contactLists.find((list) => list.id === wizardContactListId)
  const selectedSegment = cdpSegments.find((segment) => segment.slug === wizardCdpSegmentSlug)
  const recipientCount =
    wizardRecipientSource === "cdp_segment"
      ? selectedSegment?.count ?? 0
      : selectedList?.activeContacts ?? selectedList?.totalContacts ?? 0

  const canAdvanceStep2 =
    wizardRecipientSource === "contact_list" ? Boolean(wizardContactListId) : Boolean(wizardCdpSegmentSlug)

  return (
    <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) closeWizard() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Campanha — Passo {wizardStep} de 3</DialogTitle>
        </DialogHeader>

        {wizardStep === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="wizard-name">Nome da campanha *</Label>
              <Input
                id="wizard-name"
                placeholder="Ex: Newsletter Maio 2026"
                value={wizardName}
                onChange={(e) => setWizardName(e.target.value)}
                disabled={wizardCreating}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Template *</Label>
              <Select value={wizardTemplateId} onValueChange={setWizardTemplateId} disabled={wizardCreating}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum template publicado disponível</SelectItem>
                  ) : (
                    templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setWizardStep(2)}
                disabled={!wizardName.trim() || !wizardTemplateId}
              >
                Próximo →
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Origem dos destinatários *</Label>
              <Select
                value={wizardRecipientSource}
                onValueChange={(value) =>
                  setWizardRecipientSource(value as "contact_list" | "cdp_segment")
                }
                disabled={wizardCreating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact_list">Lista de contatos</SelectItem>
                  <SelectItem value="cdp_segment">Segmento CDP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {wizardRecipientSource === "contact_list" ? (
              <div className="flex flex-col gap-2">
                <Label>Lista de contatos *</Label>
                <Select value={wizardContactListId} onValueChange={setWizardContactListId} disabled={wizardCreating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists.length === 0 ? (
                      <SelectItem value="__none" disabled>Nenhuma lista disponível</SelectItem>
                    ) : (
                      contactLists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {formatContactListLabel(l)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Label>Segmento CDP *</Label>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="O que é segmento CDP?"
                        >
                          <CircleHelp className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Segmento dinâmico do Customer Data Platform: contatos filtrados por
                        regras (ex.: leads ativos, inativos). Atualiza automaticamente antes
                        de cada disparo.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={wizardCdpSegmentSlug} onValueChange={setWizardCdpSegmentSlug} disabled={wizardCreating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um segmento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cdpSegments.length === 0 ? (
                      <SelectItem value="__none" disabled>Nenhum segmento disponível</SelectItem>
                    ) : (
                      cdpSegments.map((segment) => (
                        <SelectItem key={segment.slug} value={segment.slug}>
                          {segment.name} ({segment.count})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizardStep(1)} disabled={wizardCreating}>
                ← Voltar
              </Button>
              <Button onClick={() => setWizardStep(3)} disabled={!canAdvanceStep2}>
                Próximo →
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="flex flex-col gap-4">
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              A campanha será enviada para{" "}
              <strong className="text-foreground">{recipientCount.toLocaleString("pt-BR")}</strong>{" "}
              destinatário(s){" "}
              {wizardRecipientSource === "cdp_segment" ? (
                <>
                  do segmento{" "}
                  <strong className="text-foreground">{selectedSegment?.name ?? "selecionado"}</strong>
                </>
              ) : (
                <>
                  da lista{" "}
                  <strong className="text-foreground">{selectedList?.name ?? "selecionada"}</strong>
                </>
              )}
              .
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="wizard-schedule">Agendamento</Label>
              <Input
                id="wizard-schedule"
                type="datetime-local"
                min={minDateTime}
                value={wizardScheduledAt}
                onChange={(e) => setWizardScheduledAt(e.target.value)}
                disabled={wizardCreating}
              />
              <p className="text-xs text-muted-foreground">
                {wizardScheduledAt
                  ? `Será disparada em ${formatIntimezone(
                      parseLocalToUtc(wizardScheduledAt, tz),
                      "dd/MM/yyyy HH:mm",
                      tz
                    )}`
                  : "Sem data → disparo imediato ao clicar em Disparar"}
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizardStep(2)} disabled={wizardCreating}>
                ← Voltar
              </Button>
              <Button onClick={handleCreateCampaign} disabled={wizardCreating}>
                {wizardCreating ? "Criando..." : "Criar Campanha"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
