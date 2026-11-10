"use client"

import { BadgeCheck, CalendarClock, CircleCheckBig, Loader2, UserX, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

type ToggleAction = { saving: boolean; onClick: () => void }

/**
 * Ações do card de reunião, à vista e sempre na mesma ordem: confirmar a agenda (reunião futura),
 * marcar como realizada, reagendar, no-show (quando passou sem confirmação) e cancelar.
 * Clicar no resto do card abre o lead. Cada ação só aparece para quem tem permissão.
 */
export function MeetingCardActions({
  isOverdue,
  confirmPresence,
  meetingHeld,
  onReschedule,
  onNoShow,
  onCancel,
}: {
  isOverdue: boolean
  /** Ausente quando a reunião já passou, já foi confirmada ou o usuário não pode confirmar. */
  confirmPresence?: ToggleAction
  /** Ausente quando o usuário não pode marcar (só master e closer) ou o lead não está agendado. */
  meetingHeld?: ToggleAction & { held: boolean }
  onReschedule?: () => void
  onNoShow?: () => void
  onCancel?: () => void
}) {
  const stop = (action: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation()
    action()
  }

  return (
    <>
      {confirmPresence ? (
        <Button
          size="sm"
          variant="outline"
          data-no-card-open="true"
          className="max-lg:min-h-11"
          disabled={confirmPresence.saving}
          onClick={stop(confirmPresence.onClick)}
        >
          {confirmPresence.saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BadgeCheck className="size-4" aria-hidden />}
          {confirmPresence.saving ? "Confirmando..." : "Confirmar reunião"}
        </Button>
      ) : null}
      {meetingHeld ? (
        <Button
          size="sm"
          variant={meetingHeld.held ? "default" : "outline"}
          data-no-card-open="true"
          aria-pressed={meetingHeld.held}
          className="max-lg:min-h-11"
          disabled={meetingHeld.saving}
          onClick={stop(meetingHeld.onClick)}
        >
          {meetingHeld.saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CircleCheckBig className="size-4" aria-hidden />}
          {meetingHeld.saving ? "Salvando..." : "Reunião realizada"}
        </Button>
      ) : null}
      {onReschedule ? (
        <Button size="sm" variant="outline" data-no-card-open="true" className="max-lg:min-h-11" onClick={stop(onReschedule)}>
          <CalendarClock className="size-4" aria-hidden />
          Reagendar
        </Button>
      ) : null}
      {isOverdue && onNoShow ? (
        <Button size="sm" variant="outline" data-no-card-open="true" className="max-lg:min-h-11" onClick={stop(onNoShow)}>
          <UserX className="size-4" aria-hidden />
          Não compareceu
        </Button>
      ) : null}
      {onCancel ? (
        <Button
          size="sm"
          variant="ghost"
          data-no-card-open="true"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11"
          onClick={stop(onCancel)}
        >
          <XCircle className="size-4" aria-hidden />
          Cancelar
        </Button>
      ) : null}
    </>
  )
}
