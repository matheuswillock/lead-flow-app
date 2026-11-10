/**
 * Lembretes de acompanhamento do lead: cada um vira tarefa + alerta + item no feed na data certa.
 * Este módulo só calcula datas e textos; quem grava e cria as tarefas é o caso de uso.
 */

import { MEETING_NURTURE_PLAYBOOK, nurtureStepOf } from "./meeting-nurture-playbook"

export type FollowUpKind = "administrator_interview" | "meeting_nurture" | "plan_renewal"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const FOLLOW_UP_OFFSETS = {
  "2d": { ms: 2 * DAY_MS, label: "2 dias antes" },
  "1d": { ms: DAY_MS, label: "1 dia antes" },
  "1h": { ms: HOUR_MS, label: "1 hora antes" },
  "90d": { ms: 90 * DAY_MS, label: "90 dias antes" },
  "60d": { ms: 60 * DAY_MS, label: "60 dias antes" },
  "30d": { ms: 30 * DAY_MS, label: "30 dias antes" },
} as const

export type FollowUpOffsetKey = keyof typeof FOLLOW_UP_OFFSETS

/** Opções que o usuário escolhe para lembrar o cliente da entrevista. */
export const INTERVIEW_REMINDER_OFFSETS: FollowUpOffsetKey[] = ["2d", "1d", "1h"]
/** Cadência padrão do SDR para manter o lead aquecido até a reunião. */
export const MEETING_NURTURE_OFFSETS: FollowUpOffsetKey[] = ["2d", "1d", "1h"]
/** Avisos antes do fim da vigência do plano (Carteira). */
export const PLAN_RENEWAL_OFFSETS: FollowUpOffsetKey[] = ["90d", "60d", "30d"]

export function isFollowUpOffsetKey(value: string): value is FollowUpOffsetKey {
  return Object.prototype.hasOwnProperty.call(FOLLOW_UP_OFFSETS, value)
}

export type PlannedReminder = { offsetKey: FollowUpOffsetKey; dueAt: Date }

/**
 * Datas dos lembretes antes do evento. Descarta os que já passaram — exceto, com `graceMs`, os que
 * venceram há pouco (ex.: vigência que entrou na janela de 30 dias ontem ainda gera o aviso).
 */
export function planReminders(input: {
  anchorAt: Date
  offsetKeys: readonly FollowUpOffsetKey[]
  now: Date
  graceMs?: number
}): PlannedReminder[] {
  const earliest = input.now.getTime() - (input.graceMs ?? 0)
  return [...new Set(input.offsetKeys)]
    .map((offsetKey) => ({ offsetKey, dueAt: new Date(input.anchorAt.getTime() - FOLLOW_UP_OFFSETS[offsetKey].ms) }))
    .filter((reminder) => reminder.dueAt.getTime() > earliest)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
}

/** Lembretes que fazem sentido para um evento: os que ainda caem antes dele e depois de agora. */
export function availableOffsets(anchorAt: Date, offsetKeys: readonly FollowUpOffsetKey[], now: Date): FollowUpOffsetKey[] {
  return offsetKeys.filter((key) => anchorAt.getTime() - FOLLOW_UP_OFFSETS[key].ms > now.getTime())
}

export type FollowUpCopyContext = {
  leadName: string
  /** Data do evento já formatada para leitura ("quinta-feira, 12/11, às 14:30"). */
  eventLabel: string
}

export type FollowUpCopy = { taskTitle: string; taskBody: string; notification: string }

/** Rótulo da antecedência; contatos extras (chave "custom:...") não têm antecedência fixa. */
export function offsetLabel(offsetKey: string): string {
  return isFollowUpOffsetKey(offsetKey) ? FOLLOW_UP_OFFSETS[offsetKey].label : "contato extra"
}

export function followUpCopy(kind: FollowUpKind, offsetKey: string, context: FollowUpCopyContext): FollowUpCopy {
  const when = offsetLabel(offsetKey)
  switch (kind) {
    case "administrator_interview":
      return {
        taskTitle: `Lembrar ${context.leadName} da entrevista da administradora`,
        taskBody: `A entrevista é ${context.eventLabel}. Abra o lead e use "Avisar cliente no WhatsApp" para mandar o lembrete do seu celular.`,
        notification: `Lembrete (${when}): avise ${context.leadName} da entrevista da administradora, ${context.eventLabel}.`,
      }
    case "meeting_nurture": {
      const step = MEETING_NURTURE_PLAYBOOK[nurtureStepOf(offsetKey)]
      return {
        taskTitle: `${step.title}: ${context.leadName}`,
        taskBody: `A reunião é ${context.eventLabel}. ${step.tip} Abra o lead, aba Documentos > Nutrição até a reunião, para enviar a mensagem sugerida pelo seu WhatsApp.`,
        notification: `${step.title} (${when}): reunião com ${context.leadName} ${context.eventLabel}.`,
      }
    }
    case "plan_renewal":
      return {
        taskTitle: `Reestruturar o plano de ${context.leadName}`,
        taskBody: `A vigência do plano termina ${context.eventLabel}. Fale com o cliente para revisar e reestruturar o plano atual.`,
        notification: `A vigência do plano de ${context.leadName} termina ${context.eventLabel} (${when}). Fale com o cliente para reestruturar o plano.`,
      }
  }
}
