"use client"

import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { BackofficeLeadQuickEntryFormData, BackofficeOptInCampaignInfo } from "../context/BackofficeLeadQuickEntryTypes"

interface Props {
  form: BackofficeLeadQuickEntryFormData
  onChange: (form: BackofficeLeadQuickEntryFormData) => void
  optInCampaign: BackofficeOptInCampaignInfo | null
  disabled?: boolean
}

export function BackofficeLeadQuickEntryFields({ form, onChange, optInCampaign, disabled }: Props) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="quick-entry-name">Nome</FieldLabel>
        <Input
          id="quick-entry-name"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Nome do lead"
          disabled={disabled}
          autoFocus
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="quick-entry-email">E-mail</FieldLabel>
        <Input
          id="quick-entry-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange({ ...form, email: e.target.value })}
          placeholder="lead@exemplo.com"
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="quick-entry-phone">Telefone</FieldLabel>
        <Input
          id="quick-entry-phone"
          value={form.phone}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
          placeholder="(00) 00000-0000"
          disabled={disabled}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="quick-entry-notes">Observações</FieldLabel>
        <Textarea
          id="quick-entry-notes"
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          placeholder="Contexto da ligação, interesse, etc."
          disabled={disabled}
        />
      </Field>

      {optInCampaign && (
        <Field orientation="horizontal">
          <Checkbox
            id="quick-entry-opt-in"
            checked={form.subscribeToLiveCampaign}
            onCheckedChange={(checked) =>
              onChange({ ...form, subscribeToLiveCampaign: checked === true })
            }
            disabled={disabled}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="quick-entry-opt-in" className="font-normal">
              Inscrever na Live semanal ({optInCampaign.name})
            </FieldLabel>
            <FieldDescription>
              O lead receberá um e-mail com o convite da próxima Live.
            </FieldDescription>
          </div>
        </Field>
      )}
    </FieldGroup>
  )
}
