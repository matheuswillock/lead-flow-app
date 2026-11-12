"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Sprout } from "lucide-react"
import { toast } from "sonner"

import { useTimezone } from "@/app/context/TimezoneContext"
import { useConfirmDelete } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseLocalToUtc } from "@/lib/dates"
import { MEETING_NURTURE_PLAYBOOK } from "@/lib/lead-follow-up/meeting-nurture-playbook"
import { buildWhatsAppLink } from "@/lib/lead-interview/interview-whatsapp"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { NurtureContactCard } from "./NurtureContactCard"
import { meetingNurtureService, type NurturePlan, type NurtureScope } from "./meetingNurtureService"

type Props = NurtureScope & {
  leadName: string
  leadPhone: string | null | undefined
  sdrName: string | null | undefined
  canEdit: boolean
}

function formatWhen(iso: string, tz: string, withWeekday = false): string {
  return new Intl.DateTimeFormat("pt-BR", {
    ...(withWeekday ? { weekday: "long" as const } : {}),
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
    .format(new Date(iso))
    .replace(/, (\d{2}:\d{2})$/, ", às $1")
}

/**
 * Nutrição do lead até a reunião: cadência fixa (2 dias, 1 dia e 1 hora antes, quando cabem) mais
 * contatos extras. Cada contato traz a dica e a mensagem sugerida para enviar do WhatsApp do SDR,
 * e vira tarefa + alerta na hora marcada.
 */
export function MeetingNurtureSection({ leadName, leadPhone, sdrName, canEdit, ...scope }: Props) {
  const { tz } = useTimezone()
  const { confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete()
  const [plan, setPlan] = useState<NurturePlan | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newContactLocal, setNewContactLocal] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const { leadId, teamId, supabaseId } = scope

  const load = useCallback(async () => {
    try {
      setPlan(await meetingNurtureService.list({ leadId, teamId, supabaseId }))
    } catch (error) {
      toastUserError(error)
      setPlan({ meetingAt: null, contacts: [] })
    }
  }, [leadId, teamId, supabaseId])

  useEffect(() => {
    void load()
  }, [load])

  const addContact = async () => {
    if (!newContactLocal) {
      toast.error("Escolha o dia e o horário do contato")
      return
    }
    setIsSaving(true)
    try {
      setPlan(await meetingNurtureService.add(scope, parseLocalToUtc(newContactLocal, tz).toISOString()))
      setIsAdding(false)
      setNewContactLocal("")
      toast.success("Contato adicionado", { description: "Na hora marcada, você recebe a tarefa e o alerta." })
    } catch (error) {
      toastUserError(error)
    } finally {
      setIsSaving(false)
    }
  }

  const removeContact = async (contactId: string) => {
    try {
      setPlan(await meetingNurtureService.remove(scope, contactId))
      toast.success("Contato removido")
    } catch (error) {
      toastUserError(error)
    }
  }

  if (!plan) {
    return (
      <section className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando nutrição...
      </section>
    )
  }

  if (!plan.meetingAt) return null

  const meetingLabel = formatWhen(plan.meetingAt, tz, true)
  const firstName = leadName.trim().split(/\s+/)[0] ?? ""

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 p-3" aria-labelledby="lead-nurture-title">
      {confirmDeleteDialog}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 id="lead-nurture-title" className="flex items-center gap-2 text-sm font-medium">
            <Sprout className="size-4 text-muted-foreground" aria-hidden />
            Nutrição até a reunião
          </h4>
          <p className="text-xs text-muted-foreground first-letter:uppercase">Reunião {meetingLabel}</p>
        </div>
        {canEdit && !isAdding ? (
          <Button type="button" size="sm" variant="outline" className="max-lg:min-h-11" onClick={() => setIsAdding(true)}>
            <Plus data-icon="inline-start" aria-hidden />
            Adicionar contato
          </Button>
        ) : null}
      </div>

      {isAdding ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
          <Field>
            <FieldLabel htmlFor="lead-nurture-new">Dia e horário do contato extra</FieldLabel>
            <Input
              id="lead-nurture-new"
              type="datetime-local"
              value={newContactLocal}
              onChange={(event) => setNewContactLocal(event.target.value)}
            />
            <FieldDescription>{MEETING_NURTURE_PLAYBOOK.custom.tip}</FieldDescription>
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" className="max-lg:min-h-11" disabled={isSaving} onClick={() => setIsAdding(false)}>
              Voltar
            </Button>
            <Button type="button" size="sm" className="max-lg:min-h-11" disabled={isSaving} onClick={() => void addContact()}>
              {isSaving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              Salvar contato
            </Button>
          </div>
        </div>
      ) : null}

      {plan.contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          A reunião está muito próxima para a cadência automática. Use &quot;Adicionar contato&quot; se quiser falar com o lead antes.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {plan.contacts.map((contact) => {
            const message = MEETING_NURTURE_PLAYBOOK[contact.step].buildMessage({
              firstName,
              meetingLabel,
              sdrName: sdrName ?? "",
            })
            return (
              <NurtureContactCard
                key={contact.id}
                contact={contact}
                dueLabel={formatWhen(contact.dueAt, tz)}
                message={message}
                whatsAppLink={buildWhatsAppLink(leadPhone, message)}
                canEdit={canEdit}
                onRemove={() =>
                  confirmDelete({
                    title: "Remover este contato extra?",
                    description: "A tarefa e o alerta deste contato não serão mais criados.",
                    confirmLabel: "Remover",
                    onConfirm: () => removeContact(contact.id),
                  })
                }
              />
            )
          })}
        </ol>
      )}
    </section>
  )
}
