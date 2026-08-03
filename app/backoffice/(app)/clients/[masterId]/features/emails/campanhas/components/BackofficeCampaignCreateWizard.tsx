"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import type { UseBackofficeCampanhasReturn } from "../hooks/useBackofficeCampanhas"

type Props = Pick<
  UseBackofficeCampanhasReturn,
  | "wizardOpen"
  | "wizardStep"
  | "wizardName"
  | "wizardTemplateId"
  | "wizardContactListId"
  | "wizardCreating"
  | "templates"
  | "contactLists"
  | "closeWizard"
  | "setWizardStep"
  | "setWizardName"
  | "setWizardTemplateId"
  | "setWizardContactListId"
  | "handleCreateCampaign"
  | "canManage"
>

export function BackofficeCampaignCreateWizard({
  wizardOpen,
  wizardStep,
  wizardName,
  wizardTemplateId,
  wizardContactListId,
  wizardCreating,
  templates,
  contactLists,
  closeWizard,
  setWizardStep,
  setWizardName,
  setWizardTemplateId,
  setWizardContactListId,
  handleCreateCampaign,
  canManage,
}: Props) {
  const step1Valid = wizardName.trim().length > 0 && wizardTemplateId.length > 0
  const step2Valid = wizardContactListId.length > 0

  return (
    <Dialog open={wizardOpen} onOpenChange={(open) => !open && closeWizard()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Nova campanha — Etapa {wizardStep} de 3</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {wizardStep === 1 ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="wizard-name">Nome da campanha *</FieldLabel>
                <Input
                  id="wizard-name"
                  value={wizardName}
                  onChange={(e) => setWizardName(e.target.value)}
                  placeholder="Ex: Newsletter Junho 2026"
                  disabled={wizardCreating || !canManage}
                />
              </Field>
              <Field>
                <FieldLabel>Template *</FieldLabel>
                <Select
                  value={wizardTemplateId}
                  onValueChange={setWizardTemplateId}
                  disabled={wizardCreating || !canManage}
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
            </FieldGroup>
          ) : null}

          {wizardStep === 2 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Lista de contatos *</FieldLabel>
                <Select
                  value={wizardContactListId}
                  onValueChange={setWizardContactListId}
                  disabled={wizardCreating || !canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma lista..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contactLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.totalContacts.toLocaleString("pt-BR")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          ) : null}

          {wizardStep === 3 ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{wizardName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Template</span>
                <span className="font-medium">
                  {templates.find((t) => t.id === wizardTemplateId)?.name ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Lista</span>
                <span className="font-medium">
                  {contactLists.find((l) => l.id === wizardContactListId)?.name ?? "—"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          {wizardStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setWizardStep((wizardStep - 1) as 1 | 2 | 3)}
              disabled={wizardCreating}
            >
              Voltar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={closeWizard} disabled={wizardCreating}>
              Cancelar
            </Button>
          )}
          {wizardStep < 3 ? (
            <Button
              type="button"
              onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3)}
              disabled={
                wizardCreating ||
                !canManage ||
                (wizardStep === 1 && !step1Valid) ||
                (wizardStep === 2 && !step2Valid)
              }
            >
              Próximo
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleCreateCampaign()}
              disabled={wizardCreating || !canManage || !step1Valid || !step2Valid}
            >
              {wizardCreating ? "Criando..." : "Criar campanha"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
