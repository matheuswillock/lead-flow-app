import type { InviteDispatchStatus, Lead, LeadsSchedule, Prisma } from "@prisma/client";

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E2 — extraído de
 * `LeadScheduleService.createSchedule` (o bloco `prisma.$transaction` que
 * gravava a reunião, atualizava o lead e, condicionalmente, registrava a
 * atividade de mudança de status — tudo dentro da mesma transação). O nome
 * "WithLeadTransition" reflete que as três gravações continuam atômicas.
 *
 * Esta é uma extração pura (A-E2): mesmo comportamento, mesmos campos
 * gravados, mesma ordem. Não decide política de negócio — quem chama
 * (`LeadScheduleService`, e futuramente `LeadIntakeUseCase`) resolve os
 * valores finais (link, tipo, payload de status) antes de passar aqui.
 */
export interface UpsertMeetingWithLeadTransitionExistingSchedule {
  date: Date;
  extraGuests: string[];
  googleEventId: string | null;
  googleCalendarId: string | null;
  reminder30MinSentAt: Date | null;
}

export interface UpsertMeetingWithLeadTransitionInput {
  scheduleId: string;
  leadId: string;
  meetingDate: Date;
  meetingTitle: string;
  meetingNotes?: string;
  /** `null` para reunião por telefone/WhatsApp — nunca convertido para `undefined`. */
  meetingLink: string | null;
  meetingType: string;
  extraGuests?: string[];
  closerId: string;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  inviteDispatchStatus: InviteDispatchStatus;
  inviteDispatchFallbackUsed: boolean;
  inviteDispatchLastAttemptAt: Date;
  inviteDispatchLastError: string | null;
  inviteDispatchLastPayload: Prisma.InputJsonValue | null;
  publicShareExpiresAt?: Date;
  /** `null` quando é a primeira reunião do lead (decide create vs. update). */
  existingSchedule: UpsertMeetingWithLeadTransitionExistingSchedule | null;
  /** Grava `status: scheduled` no lead na mesma escrita, quando `true`. */
  transitionStatusToScheduled: boolean;
  /**
   * Atividade de mudança de status já pronta para inserir — `null` quando a
   * transição não se aplica (já estava `scheduled`, ou não houve transição).
   * O repositório só insere; quem monta o `body`/`payload` é o chamador.
   */
  statusChangeActivity: Prisma.LeadActivityUncheckedCreateWithoutLeadInput | null;
}

export interface UpsertMeetingWithLeadTransitionResult {
  schedule: LeadsSchedule;
  lead: Lead;
}

export interface IMeetingRepository {
  /**
   * Grava a reunião (`LeadsSchedule`), atualiza os campos de agenda do lead
   * e, se `statusChangeActivity` vier preenchido, registra a atividade — tudo
   * dentro da `tx` recebida. Não abre transação própria (T-13.5).
   */
  upsertMeetingWithLeadTransition(
    tx: Prisma.TransactionClient,
    input: UpsertMeetingWithLeadTransitionInput
  ): Promise<UpsertMeetingWithLeadTransitionResult>;
}
