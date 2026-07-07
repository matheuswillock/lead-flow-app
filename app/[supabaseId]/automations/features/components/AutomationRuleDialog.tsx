"use client";

import { useEffect, useState } from "react";
import type { AutomationRule, AutomationRuleFormInput } from "../context/AutomationsTypes";
import { useAutomationsContext } from "../context/AutomationsContext";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

const STATUS_OPTIONS = [
  { value: "new_opportunity", label: "Nova oportunidade" },
  { value: "scheduled", label: "Agendado" },
  { value: "no_show", label: "No Show" },
  { value: "pricingRequest", label: "Cotação" },
  { value: "offerSubmission", label: "Proposta" },
  { value: "contract_finalized", label: "Negócio fechado" },
];

const defaultForm: AutomationRuleFormInput = {
  name: "",
  description: "",
  triggerType: "lead_created",
  triggerConfig: {},
  actionType: "create_notification",
  actionConfig: { messageTemplate: "Automação para {{lead.name}}" },
  isEnabled: true,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
};

export function AutomationRuleDialog({ open, onOpenChange, rule }: Props) {
  const { createRule, updateRule, mutationLock } = useAutomationsContext();
  const [form, setForm] = useState<AutomationRuleFormInput>(defaultForm);
  useEffect(() => {
    if (!open) return;
    if (rule) {
      setForm({
        name: rule.name,
        description: rule.description,
        triggerType: rule.triggerType,
        triggerConfig: rule.triggerConfig,
        actionType: rule.actionType,
        actionConfig: rule.actionConfig,
        isEnabled: rule.isEnabled,
      });
    } else {
      setForm(defaultForm);
    }
  }, [open, rule]);

  const handleSubmit = async () => {
    const ok = rule ? await updateRule(rule.id, form) : await createRule(form);
    if (ok) onOpenChange(false);
  };

  const updateTriggerConfig = (patch: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, triggerConfig: { ...prev.triggerConfig, ...patch } }));
  };

  const updateActionConfig = (patch: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, actionConfig: { ...prev.actionConfig, ...patch } }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar automação" : "Nova automação"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-1">
          <FieldGroup>
            <Field>
              <FieldLabel>Nome</FieldLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Field>
          </FieldGroup>

          <Separator />
          <p className="text-sm font-medium">1. Gatilho</p>
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo de gatilho</FieldLabel>
              <Select
                value={form.triggerType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    triggerType: value as AutomationRuleFormInput["triggerType"],
                    triggerConfig: {},
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead_created">Lead criado</SelectItem>
                  <SelectItem value="status_changed">Status alterado</SelectItem>
                  <SelectItem value="lead_idle_in_status">Lead parado no status</SelectItem>
                  <SelectItem value="meeting_scheduled">Reunião agendada</SelectItem>
                  <SelectItem value="meeting_no_show">No-show de reunião</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <Separator />
          <p className="text-sm font-medium">2. Condição</p>
          {(form.triggerType === "status_changed" || form.triggerType === "lead_idle_in_status") && (
            <FieldGroup>
              <Field>
                <FieldLabel>Status alvo</FieldLabel>
                <Select
                  value={String(form.triggerConfig.targetStatus ?? "")}
                  onValueChange={(value) => updateTriggerConfig({ targetStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          )}
          {form.triggerType === "lead_idle_in_status" && (
            <FieldGroup className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Tempo</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={String(form.triggerConfig.idleValue ?? "")}
                  onChange={(e) => updateTriggerConfig({ idleValue: Number(e.target.value) })}
                />
              </Field>
              <Field>
                <FieldLabel>Unidade</FieldLabel>
                <Select
                  value={String(form.triggerConfig.idleUnit ?? "days")}
                  onValueChange={(value) => updateTriggerConfig({ idleUnit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          )}

          <Separator />
          <p className="text-sm font-medium">3. Ação</p>
          <FieldGroup>
            <Field>
              <FieldLabel>Tipo de ação</FieldLabel>
              <Select
                value={form.actionType}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    actionType: value as AutomationRuleFormInput["actionType"],
                    actionConfig: {},
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_whatsapp_message">Enviar WhatsApp</SelectItem>
                  <SelectItem value="send_email">Enviar e-mail</SelectItem>
                  <SelectItem value="create_notification">Criar notificação</SelectItem>
                  <SelectItem value="assign_operator">Atribuir operador</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {(form.actionType === "send_whatsapp_message" ||
            form.actionType === "create_notification") && (
            <FieldGroup>
              <Field>
                <FieldLabel>Template da mensagem</FieldLabel>
                <Textarea
                  value={String(form.actionConfig.messageTemplate ?? "")}
                  onChange={(e) => updateActionConfig({ messageTemplate: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {"{{lead.name}}"}, {"{{lead.status}}"}
                </p>
              </Field>
            </FieldGroup>
          )}

          {form.actionType === "send_email" && (
            <FieldGroup>
              <Field>
                <FieldLabel>Assunto</FieldLabel>
                <Input
                  value={String(form.actionConfig.emailSubject ?? "")}
                  onChange={(e) => updateActionConfig({ emailSubject: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>Corpo do e-mail</FieldLabel>
                <Textarea
                  value={String(form.actionConfig.emailBodyTemplate ?? "")}
                  onChange={(e) => updateActionConfig({ emailBodyTemplate: e.target.value })}
                />
              </Field>
            </FieldGroup>
          )}

          {form.actionType === "assign_operator" && (
            <FieldGroup>
              <Field>
                <FieldLabel>Estratégia</FieldLabel>
                <Select
                  value={String(form.actionConfig.assignStrategy ?? "round_robin")}
                  onValueChange={(value) => updateActionConfig({ assignStrategy: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Rodízio</SelectItem>
                    <SelectItem value="specific_operator">Operador específico</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutationLock}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={mutationLock || !form.name.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
