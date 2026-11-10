"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BadgeCheck, CalendarClock, Loader2, MessageCircle, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useTimezone } from "@/app/context/TimezoneContext"
import { useConfirmDelete } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { parseLocalToUtc } from "@/lib/dates"
import { availableOffsets, INTERVIEW_REMINDER_OFFSETS } from "@/lib/lead-follow-up/reminder-plan"
import { buildInterviewMessage, buildWhatsAppLink, formatInterviewLocal } from "@/lib/lead-interview/interview-whatsapp"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { InterviewForm, type InterviewDraft } from "./InterviewForm"
import { InterviewNoticeDialog } from "./InterviewNoticeDialog"
import { leadInterviewService, type LeadInterview, type LeadInterviewScope } from "./leadInterviewService"

type Props = LeadInterviewScope & {
  clientName: string
  clientPhone: string | null | undefined
  brokerName: string | null | undefined
  /** Closer, manager ou master: só eles registram a entrevista e avisam o cliente. */
  canManage: boolean
}

const EMPTY_DRAFT: InterviewDraft = { scheduledLocal: "", administratorName: "", notes: "", reminderOffsets: [] }

function draftOf(interview: LeadInterview): InterviewDraft {
  return {
    scheduledLocal: interview.scheduledLocal,
    administratorName: interview.administratorName ?? "",
    notes: interview.notes ?? "",
    reminderOffsets: [],
  }
}

/**
 * Entrevista da administradora (opcional). Ao registrar, o usuário escolhe avisar o cliente na hora
 * pelo próprio WhatsApp ou deixar para depois (vira tarefa); e escolhe quando ser lembrado de avisar
 * de novo. Tudo aparece no feed de atividades do lead.
 */
export function LeadAdministratorInterviewSection({ clientName, clientPhone, brokerName, canManage, ...scope }: Props) {
  const { tz } = useTimezone()
  const { confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete()
  const [interview, setInterview] = useState<LeadInterview | null>(null)
  const [draft, setDraft] = useState<InterviewDraft>(EMPTY_DRAFT)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [askToNotify, setAskToNotify] = useState(false)
  const { leadId, teamId, supabaseId } = scope

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setInterview(await leadInterviewService.get({ leadId, teamId, supabaseId }))
    } catch (error) {
      toastUserError(error)
    } finally {
      setIsLoading(false)
    }
  }, [leadId, teamId, supabaseId])

  useEffect(() => {
    void load()
  }, [load])

  const whatsAppLink = useMemo(() => {
    if (!interview) return null
    const message = buildInterviewMessage({
      clientName,
      scheduledLocal: interview.scheduledLocal,
      administratorName: interview.administratorName,
      notes: interview.notes,
      brokerName,
    })
    return buildWhatsAppLink(clientPhone, message)
  }, [interview, clientName, clientPhone, brokerName])

  const offsetsForDraft = useMemo(() => {
    if (!draft.scheduledLocal) return INTERVIEW_REMINDER_OFFSETS
    return availableOffsets(parseLocalToUtc(draft.scheduledLocal, tz), INTERVIEW_REMINDER_OFFSETS, new Date())
  }, [draft.scheduledLocal, tz])

  const save = async () => {
    if (!draft.scheduledLocal) {
      toast.error("Informe a data e a hora da entrevista")
      return
    }
    setIsSaving(true)
    try {
      const result = await leadInterviewService.save(scope, {
        scheduledAt: parseLocalToUtc(draft.scheduledLocal, tz).toISOString(),
        scheduledLocal: draft.scheduledLocal,
        administratorName: draft.administratorName || null,
        notes: draft.notes || null,
        reminderOffsets: draft.reminderOffsets.filter((key) => offsetsForDraft.includes(key)),
      })
      setInterview(result.interview)
      setIsEditing(false)
      if (result.interview && !result.interview.clientNotifiedAt) setAskToNotify(true)
      else toast.success("Entrevista salva")
    } catch (error) {
      toastUserError(error)
    } finally {
      setIsSaving(false)
    }
  }

  const markNotified = async () => {
    setAskToNotify(false)
    try {
      setInterview(await leadInterviewService.markClientNotified(scope))
      toast.success("Aviso registrado no feed do lead")
    } catch (error) {
      toastUserError(error)
    }
  }

  const postpone = async () => {
    if (!askToNotify) return
    setAskToNotify(false)
    try {
      toast.success(await leadInterviewService.postponeClientNotice(scope), {
        description: "Ela aparece nas suas tarefas e na agenda.",
      })
    } catch (error) {
      toastUserError(error)
    }
  }

  const remove = async () => {
    setIsSaving(true)
    try {
      await leadInterviewService.remove(scope)
      setInterview(null)
      toast.success("Entrevista removida")
    } catch (error) {
      toastUserError(error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Carregando entrevista...
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 p-3" aria-labelledby="lead-interview-title">
      {confirmDeleteDialog}
      <InterviewNoticeDialog
        open={askToNotify}
        clientName={clientName.split(" ")[0] ?? ""}
        whatsAppLink={whatsAppLink}
        onSend={() => void markNotified()}
        onPostpone={() => void postpone()}
      />
      <div className="flex flex-col gap-1">
        <h4 id="lead-interview-title" className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          Entrevista da administradora
        </h4>
        {!interview && !isEditing ? (
          <p className="text-xs text-muted-foreground">
            {canManage
              ? "Opcional. Registre quando a administradora vai ligar para o cliente e avise pelo seu WhatsApp."
              : "Nenhuma entrevista registrada. Closer, manager ou master podem registrar."}
          </p>
        ) : null}
      </div>

      {isEditing ? (
        <InterviewForm
          draft={draft}
          availableOffsets={offsetsForDraft}
          saving={isSaving}
          onChange={setDraft}
          onCancel={() => setIsEditing(false)}
          onSave={() => void save()}
        />
      ) : interview ? (
        <InterviewSummary
          interview={interview}
          whatsAppLink={whatsAppLink}
          canManage={canManage}
          disabled={isSaving}
          onSend={() => void markNotified()}
          onEdit={() => {
            setDraft(draftOf(interview))
            setIsEditing(true)
          }}
          onRemove={() =>
            confirmDelete({
              title: "Remover a entrevista deste lead?",
              description: "A data, as informações e os lembretes pendentes da entrevista serão apagados.",
              confirmLabel: "Remover",
              onConfirm: remove,
            })
          }
        />
      ) : canManage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit max-lg:min-h-11"
          onClick={() => {
            setDraft(EMPTY_DRAFT)
            setIsEditing(true)
          }}
        >
          <CalendarClock data-icon="inline-start" aria-hidden />
          Registrar entrevista
        </Button>
      ) : null}
    </section>
  )
}

function InterviewSummary({
  interview,
  whatsAppLink,
  canManage,
  disabled,
  onSend,
  onEdit,
  onRemove,
}: {
  interview: LeadInterview
  whatsAppLink: string | null
  canManage: boolean
  disabled: boolean
  onSend: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  const notifiedAt = interview.clientNotifiedAt
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
        new Date(interview.clientNotifiedAt),
      )
    : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <p className="font-medium first-letter:uppercase">{formatInterviewLocal(interview.scheduledLocal)}</p>
        {interview.administratorName ? <p className="text-muted-foreground">{interview.administratorName}</p> : null}
        {interview.notes ? <p className="text-muted-foreground [overflow-wrap:anywhere]">{interview.notes}</p> : null}
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {notifiedAt ? <BadgeCheck className="size-3.5 text-semantic-success" aria-hidden /> : null}
          {notifiedAt ? `Cliente avisado em ${notifiedAt}.` : "Cliente ainda não foi avisado."}
        </p>
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          {whatsAppLink ? (
            <Button asChild size="sm" className="max-lg:min-h-11">
              <a href={whatsAppLink} target="_blank" rel="noopener noreferrer" onClick={onSend}>
                <MessageCircle data-icon="inline-start" aria-hidden />
                Avisar cliente no WhatsApp
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Cadastre o telefone do cliente para avisar pelo WhatsApp.</p>
          )}
          <Button type="button" variant="outline" size="sm" className="max-lg:min-h-11" disabled={disabled} onClick={onEdit}>
            <Pencil data-icon="inline-start" aria-hidden />
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            Remover
          </Button>
        </div>
      ) : null}
    </div>
  )
}
