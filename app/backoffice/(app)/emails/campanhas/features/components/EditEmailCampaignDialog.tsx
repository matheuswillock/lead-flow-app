"use client"

import { useEffect, useState } from "react"
import { Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { useBackofficeEmailCampaigns } from "../context/BackofficeEmailCampaignsHook"
import type { BackofficeEmailCampaignItem } from "../context/BackofficeEmailCampaignsTypes"

type Props = {
  campaign: BackofficeEmailCampaignItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEmailCampaignDialog({ campaign, open, onOpenChange }: Props) {
  const { contactLists, templates, isSaving, updateCampaign } = useBackofficeEmailCampaigns()
  const [name, setName] = useState(campaign.name)
  const [contactListId, setContactListId] = useState(campaign.contactListId)
  const [resendTemplateId, setResendTemplateId] = useState(campaign.resendTemplateId ?? "")
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(
    campaign.scheduledAt ? new Date(campaign.scheduledAt) : undefined
  )

  useEffect(() => {
    if (!open) return
    setName(campaign.name)
    setContactListId(campaign.contactListId)
    setResendTemplateId(campaign.resendTemplateId ?? "")
    setScheduledAt(campaign.scheduledAt ? new Date(campaign.scheduledAt) : undefined)
  }, [campaign, open])

  async function handleSubmit() {
    if (!name.trim() || !contactListId || !scheduledAt) return
    const selectedTemplate = templates.find((t) => t.id === resendTemplateId)
    const ok = await updateCampaign(campaign.id, {
      name: name.trim(),
      contactListId,
      scheduledAt: scheduledAt.toISOString(),
      resendTemplateId: resendTemplateId || undefined,
      resendTemplateName: selectedTemplate?.name,
    })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar campanha</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel>Nome</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Lista de contatos</FieldLabel>
              <Select value={contactListId} onValueChange={setContactListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
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
            <Field>
              <FieldLabel>Template (opcional)</FieldLabel>
              <Select value={resendTemplateId} onValueChange={setResendTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
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
              <DateTimePicker
                date={scheduledAt}
                onDateChange={setScheduledAt}
                label="Agendamento"
                disablePastDates
              />
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving || !name.trim() || !contactListId || !scheduledAt}
          >
            {isSaving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
