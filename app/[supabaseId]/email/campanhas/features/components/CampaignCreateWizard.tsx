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
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone, formatLocalInputValue, parseLocalToUtc } from "@/lib/dates"

export function CampaignCreateWizard() {
  const { tz } = useTimezone()
  const {
    wizardOpen,
    wizardStep,
    wizardName,
    wizardTemplateId,
    wizardContactListId,
    wizardScheduledAt,
    wizardCreating,
    templates,
    contactLists,
    closeWizard,
    setWizardStep,
    setWizardName,
    setWizardTemplateId,
    setWizardContactListId,
    setWizardScheduledAt,
    handleCreateCampaign,
  } = useCampanhasContext()

  // Mínimo para o input datetime-local expresso no TZ do usuário
  const minDateTime = formatLocalInputValue(new Date(), tz)

  return (
    <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) closeWizard() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Campanha — Passo {wizardStep} de 3</DialogTitle>
        </DialogHeader>

        {wizardStep === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wizard-name">Nome da campanha *</Label>
              <Input
                id="wizard-name"
                placeholder="Ex: Newsletter Maio 2026"
                value={wizardName}
                onChange={(e) => setWizardName(e.target.value)}
                disabled={wizardCreating}
              />
            </div>
            <div className="space-y-2">
              <Label>Template *</Label>
              <Select value={wizardTemplateId} onValueChange={setWizardTemplateId} disabled={wizardCreating}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum template disponível</SelectItem>
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
          <div className="space-y-4">
            <div className="space-y-2">
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
                        {l.name} ({l.totalContacts.toLocaleString("pt-BR")} contatos)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setWizardStep(1)} disabled={wizardCreating}>
                ← Voltar
              </Button>
              <Button
                onClick={() => setWizardStep(3)}
                disabled={!wizardContactListId}
              >
                Próximo →
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wizard-schedule">Agendamento (opcional)</Label>
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
