"use client"

import { useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
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

export function CreateEmailCampaignDialog() {
  const { contactLists, templates, isSaving, createCampaign } = useBackofficeEmailCampaigns()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [contactListId, setContactListId] = useState("")
  const [resendTemplateId, setResendTemplateId] = useState("")
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined)

  function resetForm() {
    setName("")
    setContactListId("")
    setResendTemplateId("")
    setScheduledAt(undefined)
  }

  async function handleSubmit() {
    if (!name.trim() || !contactListId || !scheduledAt) return

    const selectedTemplate = templates.find((t) => t.id === resendTemplateId)
    const ok = await createCampaign({
      name: name.trim(),
      contactListId,
      scheduledAt: scheduledAt.toISOString(),
      resendTemplateId: resendTemplateId || undefined,
      resendTemplateName: selectedTemplate?.name,
    })

    if (ok) {
      resetForm()
      setOpen(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Nova campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha de e-mail</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="campaign-name">Nome</FieldLabel>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Live — 30/07/2026"
                disabled={isSaving}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="campaign-list">Lista de contatos</FieldLabel>
              <Select value={contactListId} onValueChange={setContactListId} disabled={isSaving}>
                <SelectTrigger id="campaign-list" className="w-full">
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  {contactLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.totalContacts})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="campaign-template">Template (Resend)</FieldLabel>
              <Select
                value={resendTemplateId}
                onValueChange={setResendTemplateId}
                disabled={isSaving}
              >
                <SelectTrigger id="campaign-template" className="w-full">
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
              <FieldDescription>
                Gerencie templates em &quot;Templates de E-mail&quot;.
              </FieldDescription>
            </Field>

            <Field>
              <DateTimePicker
                label="Data e hora do disparo"
                date={scheduledAt}
                onDateChange={setScheduledAt}
                disabled={isSaving}
                required
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim() || !contactListId || !scheduledAt}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
