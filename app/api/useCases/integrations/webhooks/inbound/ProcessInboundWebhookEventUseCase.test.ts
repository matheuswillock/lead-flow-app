import { describe, expect, it, mock } from "bun:test";
import type { InboundEventRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookInboundEventRepository";
import { ProcessInboundWebhookEventUseCase } from "./ProcessInboundWebhookEventUseCase";
import type {
  ExistingContactLead,
  InboundScheduleResult,
  InboundTeamContext,
  InboundWebhookConfig,
} from "./InboundIntakePorts";

const NOW = new Date("2026-11-02T12:00:00.000Z");
const CLOSER_ID = "5b1e0ef3-4e8f-4d0b-9b6a-1e2d3c4b5a69";
const SDR_ID = "8c2f1a04-5f90-4e1c-8c7b-2f3e4d5c6b7a";

const team: InboundTeamContext = { teamId: "team-1", managerProfileId: "manager-1", managerSupabaseId: "sb-manager" };

const webhook: InboundWebhookConfig = {
  id: "webhook-1",
  teamId: "team-1",
  status: "active",
  contractVersion: 2,
  scopes: ["leads_create", "leads_schedule"],
  defaultMeetingLink: null,
};

function eventRow(payload: unknown, overrides: Partial<InboundEventRow> = {}): InboundEventRow {
  return {
    id: "event-1",
    webhookId: "webhook-1",
    teamId: "team-1",
    contractVersion: 2,
    idempotencyKey: "evento-123",
    requestHash: "hash",
    payload: payload as InboundEventRow["payload"],
    status: "processing",
    attemptCount: 1,
    nextAttemptAt: NOW,
    resultCode: null,
    leadId: null,
    result: null,
    idempotencyKeyReused: false,
    lastError: null,
    receivedAt: NOW,
    processedAt: null,
    ...overrides,
  };
}

const basePayload = { lead: { name: "Maria Souza", phone: "+5511999998888", email: "maria@exemplo.com" } };

function schedulePayload(extra: Record<string, unknown> = {}) {
  return {
    ...basePayload,
    schedule: {
      closer: { profile_id: CLOSER_ID },
      starts_at: "2026-11-03T14:00:00-03:00",
      ...extra,
    },
  };
}

function existingLead(overrides: Partial<ExistingContactLead> = {}): ExistingContactLead {
  return {
    id: "lead-existing",
    leadCode: "L-9",
    name: "Maria Antiga",
    status: "new_opportunity",
    email: null,
    phone: "+5511999998888",
    cnpj: null,
    notes: null,
    assignedTo: "sdr-existing",
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
    ...overrides,
  };
}

function build(overrides: {
  webhook?: Partial<InboundWebhookConfig> | null;
  accountAllowed?: boolean;
  teamFound?: boolean;
  existing?: ExistingContactLead | null;
  claim?: { assigneeProfileId: string | null; listConfigured: boolean };
  validSdr?: boolean;
  createResult?: Awaited<ReturnType<import("./InboundIntakePorts").IInboundLeadWriterPort["create"]>>;
  eligibleCloser?: boolean;
  closerHasGoogle?: boolean;
  guests?: string[];
  scheduleResult?: InboundScheduleResult;
  conflictingLeadId?: string | null;
  throwOnCreate?: Error;
} = {}) {
  const markProcessed = mock(async (_id: string, _outcome: unknown) => undefined);
  const markFailed = mock(async (_id: string, _attempts: number, _next: Date | null, _error: string) => undefined);
  const flag = mock(async (_input: Record<string, unknown>) => undefined);
  const create = mock(async (_input: Record<string, unknown>) => {
    if (overrides.throwOnCreate) throw overrides.throwOnCreate;
    return (
      overrides.createResult ?? {
        ok: true as const,
        lead: { id: "lead-new", leadCode: "L-1", name: "Maria Souza", email: "maria@exemplo.com" },
      }
    );
  });
  const merge = mock(async (_input: Record<string, unknown>) => ({ changedFields: ["email"] }));
  const claimNextAssignee = mock(async () => overrides.claim ?? { assigneeProfileId: SDR_ID, listConfigured: true });
  const isValidSdr = mock(async () => overrides.validSdr ?? true);
  const createSchedule = mock(async (_request: Record<string, unknown>) => overrides.scheduleResult ?? { ok: true as const });
  const filterTeamMemberEmails = mock(async (_teamId: string, emails: string[]) => overrides.guests ?? emails);
  const suggestSlots = mock(async (_input: Record<string, unknown>) => [
    { startsAt: "2026-11-03T14:30:00-03:00", endsAt: "2026-11-03T15:00:00-03:00" },
  ]);
  const record = mock(async (_input: Record<string, unknown>) => undefined);
  const touchUsage = mock(async (_id: string, _ok: boolean) => undefined);

  const useCase = new ProcessInboundWebhookEventUseCase({
    now: () => NOW,
    events: { markProcessed, markFailed },
    webhooks: {
      getWebhook: async () => (overrides.webhook === null ? null : { ...webhook, ...(overrides.webhook ?? {}) }),
    },
    teams: {
      getTeam: async () => (overrides.teamFound === false ? null : team),
      isAccountAllowed: async () => overrides.accountAllowed ?? true,
    },
    contacts: { findExistingContact: async () => overrides.existing ?? null },
    assignees: { claimNextAssignee, isValidSdr },
    leads: { create, merge },
    schedule: {
      isEligibleCloser: async () => overrides.eligibleCloser ?? true,
      closerHasActiveGoogle: async () => overrides.closerHasGoogle ?? true,
      filterTeamMemberEmails,
      createSchedule,
      findConflictingLeadId: async () => overrides.conflictingLeadId ?? "lead-conflicting",
      suggestSlots,
    },
    alerts: { flag },
    eventLog: { record, touchUsage },
  });

  return { useCase, suggestSlots, markProcessed, markFailed, flag, create, merge, claimNextAssignee, isValidSdr, createSchedule, filterTeamMemberEmails, record, touchUsage };
}

const outcomeOf = (fake: ReturnType<typeof build>) =>
  fake.markProcessed.mock.calls[0]?.[1] as { resultCode: string; leadId: string | null; result: Record<string, unknown> };

describe("webhook v2 — guarda do evento", () => {
  it("webhook inativo ou de outra versão: não cria nada", async () => {
    for (const patch of [{ status: "paused" as const }, { status: "disabled" as const }, { contractVersion: 1 }]) {
      const fake = build({ webhook: patch });
      await fake.useCase.execute(eventRow(basePayload));
      expect(outcomeOf(fake).resultCode).toBe("webhook_inactive");
      expect(fake.create).not.toHaveBeenCalled();
    }
  });

  it("webhook inexistente ou time inexistente: resultado terminal, sem retry", async () => {
    const noWebhook = build({ webhook: null });
    await noWebhook.useCase.execute(eventRow(basePayload));
    expect(outcomeOf(noWebhook).resultCode).toBe("webhook_inactive");

    const noTeam = build({ teamFound: false });
    await noTeam.useCase.execute(eventRow(basePayload));
    expect(outcomeOf(noTeam).resultCode).toBe("team_not_found");
    expect(noTeam.markFailed).not.toHaveBeenCalled();
  });

  it("conta pausada, suspensa ou em somente leitura: não cria lead", async () => {
    const fake = build({ accountAllowed: false });
    await fake.useCase.execute(eventRow(basePayload));
    expect(outcomeOf(fake).resultCode).toBe("account_restricted");
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("T-11.6: payload com campo obrigatório faltando termina invalid_payload, listando só o caminho", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow({ lead: { phone: "11999998888" } }));
    const outcome = outcomeOf(fake);
    expect(outcome.resultCode).toBe("invalid_payload");
    expect(JSON.stringify(outcome.result)).toContain("lead.name");
    expect(fake.create).not.toHaveBeenCalled();
  });
});

describe("webhook v2 — criar o lead (T-11.11, T-11.14)", () => {
  it("contato novo sem schedule: cria lead e termina processed", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow(basePayload));
    const outcome = outcomeOf(fake);
    expect(outcome.resultCode).toBe("processed");
    expect(outcome.leadId).toBe("lead-new");
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });

  it("campo desconhecido é aceito e listado em ignoredFields", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow({ ...basePayload, campo_novo: 1 }));
    expect(outcomeOf(fake).result.ignoredFields).toEqual(["campo_novo"]);
  });

  it("e-mail duplicado ativo (índice parcial) termina duplicate_conflict, sem lead", async () => {
    const fake = build({ createResult: { ok: false, reason: "duplicate_conflict", message: "duplicado" } });
    await fake.useCase.execute(eventRow(basePayload));
    expect(outcomeOf(fake).resultCode).toBe("duplicate_conflict");
    expect(outcomeOf(fake).leadId).toBeNull();
  });
});

describe("webhook v2 — lead que já existe (DA6: T-11.13, 13b, 13c)", () => {
  it("em nova oportunidade: mescla, não cria e não avança o rodízio", async () => {
    const fake = build({ existing: existingLead({ status: "new_opportunity" }) });
    await fake.useCase.execute(eventRow(basePayload));
    expect(outcomeOf(fake).resultCode).toBe("lead_merged");
    expect(outcomeOf(fake).leadId).toBe("lead-existing");
    expect(fake.merge).toHaveBeenCalledTimes(1);
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.claimNextAssignee).not.toHaveBeenCalled();
  });

  it("em no_show (ou qualquer outro status): cria lead novo para o contato existente", async () => {
    for (const status of ["no_show", "opportunityLost", "contract_finalized"] as const) {
      const fake = build({ existing: existingLead({ status }) });
      await fake.useCase.execute(eventRow(basePayload));
      expect(outcomeOf(fake).resultCode).toBe("processed_new_lead_for_existing_contact");
      expect(fake.create).toHaveBeenCalledTimes(1);
      expect(fake.merge).not.toHaveBeenCalled();
    }
  });

  it("em scheduled: não cria nem altera nada", async () => {
    const fake = build({ existing: existingLead({ status: "scheduled" }) });
    await fake.useCase.execute(eventRow(schedulePayload()));
    expect(outcomeOf(fake).resultCode).toBe("duplicate_scheduled_lead");
    expect(fake.create).not.toHaveBeenCalled();
    expect(fake.merge).not.toHaveBeenCalled();
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });
});

describe("webhook v2 — SDR responsável (DA11, D42: T-11.14c, 14d)", () => {
  it("sem assigned_to usa o rodízio do webhook", async () => {
    const fake = build({ claim: { assigneeProfileId: "sdr-b", listConfigured: true } });
    await fake.useCase.execute(eventRow(basePayload));
    expect(fake.claimNextAssignee).toHaveBeenCalledWith("webhook-1");
    expect(fake.create.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "sdr-b" });
  });

  it("assigned_to de SDR válido vai direto e não avança o rodízio", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow({ ...basePayload, assigned_to: { profile_id: SDR_ID } }));
    expect(fake.create.mock.calls[0]?.[0]).toMatchObject({ assignedTo: SDR_ID });
    expect(fake.claimNextAssignee).not.toHaveBeenCalled();
  });

  it("assigned_to que não é SDR válido cai no rodízio e fica registrado", async () => {
    const fake = build({ validSdr: false, claim: { assigneeProfileId: "sdr-a", listConfigured: true } });
    await fake.useCase.execute(eventRow({ ...basePayload, assigned_to: { profile_id: SDR_ID } }));
    expect(fake.create.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "sdr-a" });
    expect(outcomeOf(fake).result.assignedToIgnored).toBe("not_a_valid_sdr");
  });

  it("lista de SDRs sem nenhum válido: lead sem responsável e aviso no resultado", async () => {
    const fake = build({ claim: { assigneeProfileId: null, listConfigured: true } });
    await fake.useCase.execute(eventRow(basePayload));
    expect(fake.create.mock.calls[0]?.[0]).toMatchObject({ assignedTo: null });
    expect(outcomeOf(fake).result.warning).toBe("no_valid_assignee");
    expect(outcomeOf(fake).resultCode).toBe("processed");
  });
});

describe("webhook v2 — agendamento (DA7, DA9, DA10)", () => {
  it("T-11.12: horário livre agenda com tipo padrão call e resultado processed", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow(schedulePayload()));

    expect(fake.createSchedule).toHaveBeenCalledTimes(1);
    expect(fake.createSchedule.mock.calls[0]?.[0]).toMatchObject({
      closerProfileId: CLOSER_ID,
      type: "call",
      lead: { id: "lead-new" },
    });
    expect(outcomeOf(fake).resultCode).toBe("processed");
    expect(fake.flag).not.toHaveBeenCalled();
  });

  it("T-11.5: schedule sem o escopo leads_schedule cria o lead sem agenda e registra missing_scope", async () => {
    const fake = build({ webhook: { scopes: ["leads_create"] } });
    await fake.useCase.execute(eventRow(schedulePayload()));
    expect(outcomeOf(fake).resultCode).toBe("missing_scope");
    expect(fake.create).toHaveBeenCalledTimes(1);
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });

  it("T-11.16/17: horário ocupado vira lead nova oportunidade com alerta, sugestões e o lead em conflito", async () => {
    const fake = build({
      scheduleResult: { ok: false, reason: "slot_unavailable", message: "Este horário não está mais disponível." },
      conflictingLeadId: "lead-conflicting",
    });
    await fake.useCase.execute(eventRow(schedulePayload()));

    expect(outcomeOf(fake).resultCode).toBe("schedule_conflict_flagged");
    expect(outcomeOf(fake).leadId).toBe("lead-new");
    const alert = fake.flag.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(alert).toMatchObject({
      reasonCode: "schedule_conflict",
      requestedCloserId: CLOSER_ID,
      conflictingLeadId: "lead-conflicting",
      sourceEventId: "event-1",
    });
    expect(alert.suggestedSlots).toHaveLength(1);
  });

  it("closer que não é do time: lead criado, alerta closer_not_in_team, nenhuma agenda", async () => {
    const fake = build({ eligibleCloser: false });
    await fake.useCase.execute(eventRow(schedulePayload()));
    expect(outcomeOf(fake).resultCode).toBe("closer_not_in_team");
    expect(fake.createSchedule).not.toHaveBeenCalled();
    expect(fake.flag.mock.calls[0]?.[0]).toMatchObject({ reasonCode: "closer_not_in_team" });
  });

  // Segurança (multi-tenant): o closer vem do payload do parceiro. Um UUID que não é closer deste time
  // nunca pode virar consulta de agenda, referência no alerta nem destinatário de notificação.
  it("closer de fora do time nunca é usado: sem sugestão de horários e sem closer no alerta", async () => {
    for (const startsAt of ["2026-11-03T14:00:00-03:00", "2026-11-02T12:03:00Z", "2027-06-01T12:00:00Z"]) {
      const fake = build({ eligibleCloser: false });
      await fake.useCase.execute(eventRow(schedulePayload({ starts_at: startsAt })));

      expect(fake.suggestSlots).not.toHaveBeenCalled();
      const alert = fake.flag.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(alert.requestedCloserId).toBeNull();
      expect(alert.suggestedSlots).toEqual([]);
      expect(JSON.stringify(alert)).not.toContain(CLOSER_ID);
    }
  });

  it("closer do time continua entrando nas sugestões e no alerta", async () => {
    const fake = build({ scheduleResult: { ok: false, reason: "slot_unavailable", message: "Este horário não está mais disponível." } });
    await fake.useCase.execute(eventRow(schedulePayload()));
    expect(fake.suggestSlots).toHaveBeenCalledTimes(1);
    expect(fake.flag.mock.calls[0]?.[0]).toMatchObject({ requestedCloserId: CLOSER_ID });
  });

  it("horário a menos de 5 minutos ou já passado: alerta schedule_in_past", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow(schedulePayload({ starts_at: "2026-11-02T12:03:00Z" })));
    expect(outcomeOf(fake).resultCode).toBe("schedule_in_past");
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });

  it("horário além de 180 dias: alerta schedule_out_of_range", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow(schedulePayload({ starts_at: "2027-06-01T12:00:00Z" })));
    expect(outcomeOf(fake).resultCode).toBe("schedule_out_of_range");
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });

  it("T-11.21: reunião online sem e-mail do lead nunca vira agendada: alerta online_without_email", async () => {
    const fake = build({
      createResult: { ok: true, lead: { id: "lead-new", leadCode: "L-1", name: "Maria", email: null } },
    });
    await fake.useCase.execute(
      eventRow({ lead: { name: "Maria", phone: "11999998888" }, schedule: { closer: { profile_id: CLOSER_ID }, starts_at: "2026-11-03T14:00:00-03:00", type: "online" } }),
    );
    expect(outcomeOf(fake).resultCode).toBe("online_without_email");
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });

  it("T-11.21c: online com closer sem Google usa o link de Meet padrão do webhook", async () => {
    const fake = build({ closerHasGoogle: false, webhook: { defaultMeetingLink: "https://meet.google.com/abc-defg-hij" } });
    await fake.useCase.execute(eventRow(schedulePayload({ type: "online" })));
    expect(fake.createSchedule.mock.calls[0]?.[0]).toMatchObject({ type: "online", meetingLink: "https://meet.google.com/abc-defg-hij" });
    expect(outcomeOf(fake).resultCode).toBe("processed");
  });

  it("online com closer sem Google e sem link padrão: alerta closer_without_google", async () => {
    const fake = build({ closerHasGoogle: false });
    await fake.useCase.execute(eventRow(schedulePayload({ type: "online" })));
    expect(outcomeOf(fake).resultCode).toBe("closer_without_google");
    expect(fake.createSchedule).not.toHaveBeenCalled();
  });

  it("online com closer que tem Google não leva link manual (o Meet é gerado)", async () => {
    const fake = build({ closerHasGoogle: true, webhook: { defaultMeetingLink: "https://meet.google.com/abc-defg-hij" } });
    await fake.useCase.execute(eventRow(schedulePayload({ type: "online" })));
    expect((fake.createSchedule.mock.calls[0]?.[0] as { meetingLink?: string }).meetingLink).toBeUndefined();
  });

  it("convidados só membros do time: os demais são descartados e contados", async () => {
    const fake = build({ guests: ["colega@time.com.br"] });
    await fake.useCase.execute(eventRow(schedulePayload({ guests: ["colega@time.com.br", "externo@fora.com"] })));
    expect(fake.createSchedule.mock.calls[0]?.[0]).toMatchObject({ guests: ["colega@time.com.br"] });
    expect(outcomeOf(fake).result.guestsIgnored).toBe(1);
  });

  it("falha inesperada ao agendar vira alerta schedule_failed, sem perder o lead", async () => {
    const fake = build({ scheduleResult: { ok: false, reason: "failed", message: "Google indisponível" } });
    await fake.useCase.execute(eventRow(schedulePayload()));
    expect(outcomeOf(fake).resultCode).toBe("schedule_failed");
    expect(outcomeOf(fake).leadId).toBe("lead-new");
    expect(fake.flag.mock.calls[0]?.[0]).toMatchObject({ reasonCode: "schedule_failed" });
  });

  it("DA6 + D39: evento com agenda para lead em nova oportunidade mescla e agenda o lead existente", async () => {
    const fake = build({ existing: existingLead({ status: "new_opportunity", email: "maria@exemplo.com" }) });
    await fake.useCase.execute(eventRow(schedulePayload()));
    expect(outcomeOf(fake).resultCode).toBe("lead_merged");
    expect(fake.createSchedule.mock.calls[0]?.[0]).toMatchObject({ lead: { id: "lead-existing", assignedTo: "sdr-existing" } });
  });
});

describe("webhook v2 — retry, dead-letter e log (T-11.9)", () => {
  it("exceção inesperada devolve o evento para pending com backoff", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const fake = build({ throwOnCreate: new Error("banco indisponível") });
      await fake.useCase.execute(eventRow(basePayload, { attemptCount: 1 }));
      expect(fake.markProcessed).not.toHaveBeenCalled();
      const [id, attempts, next, error] = fake.markFailed.mock.calls[0] ?? [];
      expect(id).toBe("event-1");
      expect(attempts).toBe(1);
      expect(next).toBeInstanceOf(Date);
      expect(error).toBe("banco indisponível");
    } finally {
      console.error = original;
    }
  });

  it("depois da 5ª tentativa o evento vai para dead-letter (sem próxima tentativa)", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const fake = build({ throwOnCreate: new Error("banco indisponível") });
      await fake.useCase.execute(eventRow(basePayload, { attemptCount: 5 }));
      expect(fake.markFailed.mock.calls[0]?.[2]).toBeNull();
    } finally {
      console.error = original;
    }
  });

  it("grava no log do webhook o event_id, o resultCode e a marca de replay", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow(basePayload, { idempotencyKeyReused: true }));
    expect(fake.record.mock.calls[0]?.[0]).toMatchObject({
      teamId: "team-1",
      webhookId: "webhook-1",
      result: "success",
      responsePayload: { event_id: "event-1", result_code: "processed", lead_id: "lead-new", idempotency_key_reused: true },
    });
    expect(fake.touchUsage).toHaveBeenCalledWith("webhook-1", true);
  });

  it("evento rejeitado aparece como rejected no log", async () => {
    const fake = build();
    await fake.useCase.execute(eventRow({ lead: {} }));
    expect(fake.record.mock.calls[0]?.[0]).toMatchObject({ result: "rejected" });
  });

  it("falha ao gravar o log não desfaz o evento já processado", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const fake = build();
      fake.record.mockRejectedValueOnce(new Error("log indisponível"));
      await fake.useCase.execute(eventRow(basePayload));
      expect(fake.markProcessed).toHaveBeenCalledTimes(1);
      expect(fake.markFailed).not.toHaveBeenCalled();
    } finally {
      console.error = original;
    }
  });
});
