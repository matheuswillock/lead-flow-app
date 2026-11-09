"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FOLLOW_UP_OFFSETS, type FollowUpOffsetKey } from "@/lib/lead-follow-up/reminder-plan"

export type InterviewDraft = {
  scheduledLocal: string
  administratorName: string
  notes: string
  reminderOffsets: FollowUpOffsetKey[]
}

/** Formulário da entrevista; os lembretes oferecidos são só os que ainda caem antes dela. */
export function InterviewForm({
  draft,
  availableOffsets,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: InterviewDraft
  availableOffsets: FollowUpOffsetKey[]
  saving: boolean
  onChange: (draft: InterviewDraft) => void
  onCancel: () => void
  onSave: () => void
}) {
  const toggleOffset = (key: FollowUpOffsetKey, checked: boolean) =>
    onChange({
      ...draft,
      reminderOffsets: checked ? [...draft.reminderOffsets, key] : draft.reminderOffsets.filter((item) => item !== key),
    })

  return (
    <FieldGroup className="gap-3">
      <Field>
        <FieldLabel htmlFor="lead-interview-date">Data e hora</FieldLabel>
        <Input
          id="lead-interview-date"
          type="datetime-local"
          value={draft.scheduledLocal}
          onChange={(event) => onChange({ ...draft, scheduledLocal: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="lead-interview-admin">Administradora</FieldLabel>
        <Input
          id="lead-interview-admin"
          value={draft.administratorName}
          maxLength={120}
          placeholder="Ex.: Qualicorp"
          onChange={(event) => onChange({ ...draft, administratorName: event.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="lead-interview-notes">Observação para o cliente</FieldLabel>
        <Textarea
          id="lead-interview-notes"
          value={draft.notes}
          maxLength={1000}
          rows={2}
          placeholder="Ex.: A ligação vem de um número 0800."
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
        />
        <FieldDescription>Entra na mensagem do WhatsApp.</FieldDescription>
      </Field>
      {availableOffsets.length > 0 ? (
        <FieldSet>
          <FieldLegend variant="label">Lembrar-me de avisar o cliente de novo</FieldLegend>
          <FieldDescription>Cada lembrete vira uma tarefa e um alerta para você.</FieldDescription>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {availableOffsets.map((key) => (
              <Field key={key} orientation="horizontal" className="w-auto">
                <Checkbox
                  id={`lead-interview-offset-${key}`}
                  checked={draft.reminderOffsets.includes(key)}
                  onCheckedChange={(checked) => toggleOffset(key, checked === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`lead-interview-offset-${key}`} className="font-normal">
                    {FOLLOW_UP_OFFSETS[key].label}
                  </FieldLabel>
                </FieldContent>
              </Field>
            ))}
          </div>
        </FieldSet>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="max-lg:min-h-11" disabled={saving} onClick={onCancel}>
          Voltar
        </Button>
        <Button type="button" size="sm" className="max-lg:min-h-11" disabled={saving} onClick={onSave}>
          {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
          Salvar entrevista
        </Button>
      </div>
    </FieldGroup>
  )
}
