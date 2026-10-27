import type { Prisma } from "@prisma/client";
import type {
  InboundEventRow,
  ITeamWebhookInboundEventRepository,
} from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookInboundEventRepository";
import { Output } from "@/lib/output";
import { computeWebhookOutboxNextAttemptAt } from "@/lib/webhooks/webhookOutboxBackoff";
import { parseInboundV2Payload, type InboundV2Payload } from "@/lib/webhooks/inbound/v2/payload";
import {
  INBOUND_RESULT_CODES,
  resolveInboundLogResult,
  type InboundResultCode,
} from "@/lib/webhooks/inbound/v2/resultCodes";
import type {
  ExistingContactLead,
  IInboundAlertPort,
  IInboundAssigneePort,
  IInboundContactPort,
  IInboundEventLogPort,
  IInboundLeadWriterPort,
  IInboundSchedulePort,
  IInboundTeamPort,
  IInboundWebhookConfigPort,
  InboundTeamContext,
  InboundWebhookConfig,
} from "./InboundIntakePorts";

/** Antecedência mínima e horizonte máximo do `schedule.starts_at` (guia: 5 minutos a 180 dias). */
const MIN_LEAD_TIME_MS = 5 * 60 * 1000;
const MAX_HORIZON_MS = 180 * 24 * 60 * 60 * 1000;

type ScheduleOutcome = {
  resultCode: InboundResultCode | null;
  detail: Record<string, unknown>;
};

type Outcome = {
  resultCode: InboundResultCode;
  leadId: string | null;
  /** Código público do lead, usado pelo link do CRM na aba Logs. */
  leadCode?: string | null;
  result: Record<string, unknown>;
};

export type ProcessInboundWebhookEventDeps = {
  events: Pick<ITeamWebhookInboundEventRepository, "markProcessed" | "markFailed">;
  webhooks: IInboundWebhookConfigPort;
  teams: IInboundTeamPort;
  contacts: IInboundContactPort;
  assignees: IInboundAssigneePort;
  leads: IInboundLeadWriterPort;
  schedule: IInboundSchedulePort;
  alerts: IInboundAlertPort;
  eventLog: IInboundEventLogPort;
  now?: () => Date;
};

/**
 * Processamento assíncrono de um evento do webhook v2 (SPEC 11, DA4 parte assíncrona, DA6 a DA11).
 *
 * Só chega aqui um evento já gravado e reivindicado (`processing`). Toda decisão de negócio vive
 * aqui; HTTP, persistência e agenda ficam nas portas. Qualquer exceção inesperada devolve o evento
 * para retry com backoff (dead-letter após 5 tentativas), então nenhum evento aceito se perde.
 */
export class ProcessInboundWebhookEventUseCase {
  private readonly now: () => Date;

  constructor(private readonly deps: ProcessInboundWebhookEventDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** `isValid` é falso só quando o evento volta para retry; o desfecho de negócio vai em `result`. */
  async execute(row: InboundEventRow): Promise<Output> {
    try {
      const webhook = await this.deps.webhooks.getWebhook(row.webhookId);
      const outcome = await this.decide(row, webhook);
      await this.deps.events.markProcessed(row.id, {
        resultCode: outcome.resultCode,
        leadId: outcome.leadId,
        result: outcome.result as Prisma.InputJsonValue,
      });
      await this.writeLog(row, outcome);
      return new Output(true, ["Evento processado"], [], { resultCode: outcome.resultCode, leadId: outcome.leadId });
    } catch (error) {
      await this.failForRetry(row, error);
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao processar o evento"], null);
    }
  }

  private async decide(row: InboundEventRow, webhook: InboundWebhookConfig | null): Promise<Outcome> {
    if (!webhook || webhook.status !== "active" || webhook.contractVersion !== 2) {
      return this.terminal(INBOUND_RESULT_CODES.webhookInactive);
    }

    const team = await this.deps.teams.getTeam(webhook.teamId);
    if (!team) return this.terminal(INBOUND_RESULT_CODES.teamNotFound);
    if (!(await this.deps.teams.isAccountAllowed(team))) {
      return this.terminal(INBOUND_RESULT_CODES.accountRestricted);
    }

    const parsed = parseInboundV2Payload(row.payload);
    if (!parsed.ok) {
      return this.terminal(INBOUND_RESULT_CODES.invalidPayload, { issues: parsed.issues });
    }

    const { data, ignoredFields } = parsed;
    const hasScheduleScope = webhook.scopes.includes("leads_schedule");
    const requestedSchedule = data.schedule;
    const missingScope = Boolean(requestedSchedule) && !hasScheduleScope;

    const existing = await this.deps.contacts.findExistingContact(team.teamId, {
      phone: data.lead.phone,
      email: data.lead.email,
      cnpj: data.lead.cnpj,
    });

    // DA6: lead em agendado não é criado nem alterado.
    if (existing?.status === "scheduled") {
      return {
        resultCode: INBOUND_RESULT_CODES.duplicateScheduledLead,
        leadId: existing.id,
        leadCode: existing.leadCode,
        result: { ignoredFields },
      };
    }

    const base = existing && (existing.status === null || existing.status === "new_opportunity")
      ? await this.mergeIntoExisting(team, existing, data, row.id)
      : await this.createNew(team, webhook, data, row.id, ignoredFields, existing);

    if (base.kind === "stop") return base.outcome;

    const result: Record<string, unknown> = { ignoredFields, ...base.detail };
    let resultCode = base.resultCode;

    if (missingScope) {
      resultCode = INBOUND_RESULT_CODES.missingScope;
      result.scheduleIgnored = "missing_scope";
    } else if (requestedSchedule) {
      const scheduled = await this.applySchedule({
        team,
        webhook,
        data,
        schedule: requestedSchedule,
        lead: base.lead,
        eventId: row.id,
      });
      Object.assign(result, scheduled.detail);
      if (scheduled.resultCode) resultCode = scheduled.resultCode;
    }

    return { resultCode, leadId: base.lead.id, leadCode: base.lead.leadCode, result };
  }

  private async mergeIntoExisting(
    team: InboundTeamContext,
    existing: ExistingContactLead,
    data: InboundV2Payload,
    eventId: string,
  ) {
    // Mesclar não avança o rodízio e não troca o SDR do lead existente (D40).
    const merged = await this.deps.leads.merge({ team, existing, payload: data, eventId });
    return {
      kind: "continue" as const,
      resultCode: INBOUND_RESULT_CODES.leadMerged as InboundResultCode,
      lead: {
        id: existing.id,
        leadCode: existing.leadCode,
        name: existing.name,
        email: existing.email ?? data.lead.email ?? null,
        status: existing.status,
        assignedTo: existing.assignedTo,
      },
      detail: { changedFields: merged.changedFields },
    };
  }

  private async createNew(
    team: InboundTeamContext,
    webhook: InboundWebhookConfig,
    data: InboundV2Payload,
    eventId: string,
    ignoredFields: string[],
    existing: ExistingContactLead | null,
  ) {
    const detail: Record<string, unknown> = {};
    const assignedTo = await this.resolveAssignee(team, webhook, data, detail);

    const created = await this.deps.leads.create({ team, payload: data, assignedTo, eventId, ignoredFields });
    if (!created.ok) {
      return {
        kind: "stop" as const,
        outcome: {
          resultCode:
            created.reason === "duplicate_conflict"
              ? INBOUND_RESULT_CODES.duplicateConflict
              : (INBOUND_RESULT_CODES.invalidPayload as InboundResultCode),
          leadId: null,
          result: { ignoredFields, reason: created.reason },
        } satisfies Outcome,
      };
    }

    return {
      kind: "continue" as const,
      resultCode: (existing
        ? INBOUND_RESULT_CODES.processedNewLeadForExistingContact
        : INBOUND_RESULT_CODES.processed) as InboundResultCode,
      lead: {
        id: created.lead.id,
        leadCode: created.lead.leadCode,
        name: created.lead.name,
        email: created.lead.email,
        status: "new_opportunity" as const,
        assignedTo,
      },
      detail,
    };
  }

  /** DA11/D42: `assigned_to` válido vai direto (sem avançar o rodízio); senão, rodízio dos SDRs padrão. */
  private async resolveAssignee(
    team: InboundTeamContext,
    webhook: InboundWebhookConfig,
    data: InboundV2Payload,
    detail: Record<string, unknown>,
  ): Promise<string | null> {
    if (data.assignedToProfileId) {
      if (await this.deps.assignees.isValidSdr(team.teamId, data.assignedToProfileId)) {
        return data.assignedToProfileId;
      }
      detail.assignedToIgnored = "not_a_valid_sdr";
    }

    const claimed = await this.deps.assignees.claimNextAssignee(webhook.id);
    if (!claimed.assigneeProfileId && claimed.listConfigured) {
      detail.warning = INBOUND_RESULT_CODES.noValidAssignee;
    }
    return claimed.assigneeProfileId;
  }

  private async applySchedule(input: {
    team: InboundTeamContext;
    webhook: InboundWebhookConfig;
    data: InboundV2Payload;
    schedule: NonNullable<InboundV2Payload["schedule"]>;
    lead: { id: string; leadCode: string | null; name: string; email: string | null; status: ExistingContactLead["status"]; assignedTo: string | null };
    eventId: string;
  }): Promise<ScheduleOutcome> {
    const { team, webhook, schedule, lead, eventId } = input;
    const type = schedule.type ?? "call";
    const now = this.now();

    // Segurança (multi-tenant): `closer.profile_id` vem do payload do parceiro. Antes de qualquer outro
    // uso, confirma que é closer deste time. Um UUID de fora nunca vira consulta de agenda, referência
    // no alerta nem destinatário de notificação.
    const closerEligible = await this.deps.schedule.isEligibleCloser(team.teamId, schedule.closerProfileId);

    const flag = async (reasonCode: string, resultCode: InboundResultCode, conflictingLeadId: string | null = null) => {
      const suggestedSlots = closerEligible
        ? await this.deps.schedule.suggestSlots({
            teamId: team.teamId,
            closerProfileId: schedule.closerProfileId,
            from: schedule.startsAt,
          })
        : [];
      await this.deps.alerts.flag({
        team,
        lead,
        reasonCode,
        requestedStartsAt: schedule.startsAt,
        requestedCloserId: closerEligible ? schedule.closerProfileId : null,
        conflictingLeadId,
        suggestedSlots,
        sourceEventId: eventId,
      });
      return { resultCode, detail: { scheduleFlagged: reasonCode } } satisfies ScheduleOutcome;
    };

    if (schedule.startsAt.getTime() < now.getTime() + MIN_LEAD_TIME_MS) {
      return flag(INBOUND_RESULT_CODES.scheduleInPast, INBOUND_RESULT_CODES.scheduleInPast);
    }
    if (schedule.startsAt.getTime() > now.getTime() + MAX_HORIZON_MS) {
      return flag(INBOUND_RESULT_CODES.scheduleOutOfRange, INBOUND_RESULT_CODES.scheduleOutOfRange);
    }
    if (!closerEligible) {
      return flag(INBOUND_RESULT_CODES.closerNotInTeam, INBOUND_RESULT_CODES.closerNotInTeam);
    }
    // T-11.21: reunião online exige e-mail do lead; nunca `scheduled` sem os requisitos.
    if (type === "online" && !lead.email) {
      return flag(INBOUND_RESULT_CODES.onlineWithoutEmail, INBOUND_RESULT_CODES.onlineWithoutEmail);
    }

    // DA10: closer sem Google usa o link de Meet padrão do webhook; sem ele, não marca.
    let meetingLink: string | undefined;
    if (type === "online" && !(await this.deps.schedule.closerHasActiveGoogle(schedule.closerProfileId))) {
      if (!webhook.defaultMeetingLink) {
        return flag(INBOUND_RESULT_CODES.closerWithoutGoogle, INBOUND_RESULT_CODES.closerWithoutGoogle);
      }
      meetingLink = webhook.defaultMeetingLink;
    }

    // Convidados só podem ser membros do time; os demais são descartados e registrados.
    const requestedGuests = schedule.guests ?? [];
    const guests = requestedGuests.length
      ? await this.deps.schedule.filterTeamMemberEmails(team.teamId, requestedGuests)
      : [];
    const detail: Record<string, unknown> = {};
    if (guests.length < requestedGuests.length) detail.guestsIgnored = requestedGuests.length - guests.length;

    const created = await this.deps.schedule.createSchedule({
      team,
      lead,
      closerProfileId: schedule.closerProfileId,
      startsAt: schedule.startsAt,
      type,
      title: schedule.title,
      notes: schedule.notes,
      guests,
      meetingLink,
    });

    if (created.ok) return { resultCode: null, detail };

    if (created.reason === "slot_unavailable") {
      const conflictingLeadId = await this.deps.schedule.findConflictingLeadId(
        team.teamId,
        schedule.closerProfileId,
        schedule.startsAt,
      );
      const flagged = await flag("schedule_conflict", INBOUND_RESULT_CODES.scheduleConflictFlagged, conflictingLeadId);
      return { resultCode: flagged.resultCode, detail: { ...detail, ...flagged.detail } };
    }

    const flagged = await flag(INBOUND_RESULT_CODES.scheduleFailed, INBOUND_RESULT_CODES.scheduleFailed);
    return { resultCode: flagged.resultCode, detail: { ...detail, ...flagged.detail, scheduleError: created.message } };
  }

  private terminal(resultCode: InboundResultCode, result: Record<string, unknown> = {}): Outcome {
    return { resultCode, leadId: null, result };
  }

  private async writeLog(row: InboundEventRow, outcome: Outcome): Promise<void> {
    const logResult = resolveInboundLogResult(outcome.resultCode);
    try {
      await this.deps.eventLog.record({
        teamId: row.teamId,
        webhookId: row.webhookId,
        result: logResult,
        requestPayload: row.payload,
        responsePayload: {
          event_id: row.id,
          result_code: outcome.resultCode,
          lead_id: outcome.leadId,
          lead_code: outcome.leadCode ?? null,
          idempotency_key_reused: row.idempotencyKeyReused,
          ...outcome.result,
        } as Prisma.InputJsonValue,
        errorMessage: logResult === "success" ? null : outcome.resultCode,
      });
      await this.deps.eventLog.touchUsage(row.webhookId, logResult === "success");
    } catch (error) {
      // O log é observabilidade: falhar nele não pode desfazer um evento já processado.
      console.error("[ProcessInboundWebhookEvent] Falha ao gravar o log do evento:", error);
    }
  }

  private async failForRetry(row: InboundEventRow, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao processar o evento";
    console.error("[ProcessInboundWebhookEvent] Falha ao processar o evento:", { eventId: row.id, message });
    const nextAttemptAt = computeWebhookOutboxNextAttemptAt(row.attemptCount, this.now());
    await this.deps.events.markFailed(row.id, row.attemptCount, nextAttemptAt, message);
  }
}
