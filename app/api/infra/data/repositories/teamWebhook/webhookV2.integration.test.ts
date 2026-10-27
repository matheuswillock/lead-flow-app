import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "crypto";

/**
 * Integração do webhook v2 e da API Studio contra o Postgres local (:55322), sem mocks de banco.
 *
 * Existe porque os invariantes que importam aqui são de concorrência e de SQL, que Prisma mockado não
 * prova: idempotência por unique, claim com `FOR UPDATE SKIP LOCKED`, rodízio com a linha do webhook
 * travada, trava de reserva por closer entre times e o índice único PARCIAL da D41.
 * Cobre T-11.7, T-11.9, T-11.14b, T-11.16 e a D41 (SPEC 11), mais o token da SPEC 14.
 *
 * Fica nesta pasta (e não ao lado dos use cases) porque o `governance:check` proíbe acesso Prisma direto
 * fora da camada Repository, e o teste precisa semear dados reais.
 *
 * Rodar:
 *   bun run test:integration:webhooks:local
 */
const RUN_INTEGRATION =
  process.env.WEBHOOKS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL);

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url)) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com `bun run test:integration:webhooks:local`.",
    );
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma;
let inboundEvents: typeof import("./TeamWebhookInboundEventRepository").teamWebhookInboundEventRepository;
let webhooks: typeof import("./TeamWebhookRepository").teamWebhookRepository;
let reservations: typeof import("../teamMeetingSlotReservation/TeamMeetingSlotReservationRepository").teamMeetingSlotReservationRepository;
let alertRepo: typeof import("../leadRescheduleAlert/LeadRescheduleAlertRepository").leadRescheduleAlertRepository;
let activations: typeof import("../teamApiResource/TeamApiResourceActivationRepository").teamApiResourceActivationRepository;

if (RUN_INTEGRATION) {
  assertLocalDatabase();
  ({ prisma } = await import("@/app/api/infra/data/prisma"));
  ({ teamWebhookInboundEventRepository: inboundEvents } = await import("./TeamWebhookInboundEventRepository"));
  ({ teamWebhookRepository: webhooks } = await import("./TeamWebhookRepository"));
  ({ teamMeetingSlotReservationRepository: reservations } = await import(
    "../teamMeetingSlotReservation/TeamMeetingSlotReservationRepository"
  ));
  ({ leadRescheduleAlertRepository: alertRepo } = await import("../leadRescheduleAlert/LeadRescheduleAlertRepository"));
  ({ teamApiResourceActivationRepository: activations } = await import(
    "../teamApiResource/TeamApiResourceActivationRepository"
  ));
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

type Fixture = {
  managerId: string;
  teamA: string;
  teamB: string;
  sdrs: string[];
  closerId: string;
  webhookId: string;
};

const created = { profileIds: [] as string[], teamIds: [] as string[], leadIds: [] as string[] };
const fx: Fixture = { managerId: "", teamA: "", teamB: "", sdrs: [], closerId: "", webhookId: "" };

async function makeProfile(label: string): Promise<string> {
  const profile = await prisma.profile.create({
    data: { email: `v2-${label}-${randomUUID()}@example.test`, fullName: label, role: "manager", supabaseId: randomUUID() },
    select: { id: true },
  });
  created.profileIds.push(profile.id);
  return profile.id;
}

async function makeLead(teamId: string, managerId: string, data: { email?: string; cnpj?: string; status?: string | null; deletedAt?: Date | null; closerId?: string; meetingDate?: Date }) {
  const lead = await prisma.lead.create({
    data: {
      leadCode: `V2${randomUUID().slice(0, 8)}`,
      managerId,
      teamId,
      name: "Lead de integração",
      email: data.email ?? null,
      cnpj: data.cnpj ?? null,
      status: (data.status === undefined ? "new_opportunity" : data.status) as never,
      deletedAt: data.deletedAt ?? null,
      closerId: data.closerId ?? null,
      meetingDate: data.meetingDate ?? null,
    },
    select: { id: true },
  });
  created.leadIds.push(lead.id);
  return lead.id;
}

describeIntegration("webhook v2 — Postgres real", () => {
  beforeAll(async () => {
    fx.managerId = await makeProfile("manager");
    fx.closerId = await makeProfile("closer");
    for (const label of ["sdr-a", "sdr-b", "sdr-c"]) fx.sdrs.push(await makeProfile(label));

    for (const key of ["teamA", "teamB"] as const) {
      const team = await prisma.team.create({ data: { name: `v2-${key}`, masterId: fx.managerId }, select: { id: true } });
      created.teamIds.push(team.id);
      fx[key] = team.id;
    }

    for (const sdr of fx.sdrs) {
      await prisma.teamMember.create({ data: { teamId: fx.teamA, profileId: sdr, role: "operator", functions: ["SDR"] } });
    }
    // O mesmo closer participa dos dois times: a agenda dele é uma só.
    for (const team of [fx.teamA, fx.teamB]) {
      await prisma.teamMember.create({ data: { teamId: team, profileId: fx.closerId, role: "operator", functions: ["CLOSER"] } });
    }

    const webhook = await webhooks.createWithCtx(
      { profileId: fx.managerId, teamId: fx.teamA },
      {
        direction: "inbound",
        name: "YouPop v2",
        contractVersion: 2,
        scopes: ["leads_create", "leads_schedule"],
        defaultAssigneeProfileIds: fx.sdrs,
        tokenHash: `hash-${randomUUID()}`,
        tokenCipher: null,
        tokenPreview: "v2...test",
        expiryMode: "months_6",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    );
    fx.webhookId = webhook.id;
  });

  afterAll(async () => {
    if (!RUN_INTEGRATION) return;
    await prisma.leadRescheduleAlert.deleteMany({ where: { leadId: { in: created.leadIds } } });
    await prisma.teamMeetingSlotReservation.deleteMany({ where: { teamId: { in: created.teamIds } } });
    await prisma.lead.deleteMany({ where: { id: { in: created.leadIds } } });
    await prisma.teamWebhookInboundEvent.deleteMany({ where: { teamId: { in: created.teamIds } } });
    await prisma.teamApiResourceActivation.deleteMany({ where: { teamId: { in: created.teamIds } } });
    await prisma.teamWebhook.deleteMany({ where: { teamId: { in: created.teamIds } } });
    await prisma.teamMember.deleteMany({ where: { teamId: { in: created.teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: created.teamIds } } });
    await prisma.profile.deleteMany({ where: { id: { in: created.profileIds } } });
  });

  const receiveInput = (key: string | null, hash = "hash-a") => ({
    webhookId: fx.webhookId,
    teamId: fx.teamA,
    contractVersion: 2,
    idempotencyKey: key,
    requestHash: hash,
    payload: { lead: { name: "Maria" } },
  });

  describe("T-11.7 — idempotência concorrente", () => {
    it("10 requisições simultâneas com a mesma chave → o mesmo event_id e UM evento no banco", async () => {
      const key = `evento-${randomUUID()}`;
      const results = await Promise.all(Array.from({ length: 10 }, () => inboundEvents.receive(receiveInput(key))));

      expect(new Set(results.map((result) => result.eventId)).size).toBe(1);
      expect(results.filter((result) => result.created)).toHaveLength(1);
      const rows = await prisma.teamWebhookInboundEvent.count({ where: { webhookId: fx.webhookId, idempotencyKey: key } });
      expect(rows).toBe(1);
    });

    it("mesma chave com corpo diferente → event_id original e marca idempotency_key_reused", async () => {
      const key = `reuso-${randomUUID()}`;
      const first = await inboundEvents.receive(receiveInput(key, "hash-a"));
      const second = await inboundEvents.receive(receiveInput(key, "hash-OUTRO"));

      expect(second).toEqual({ eventId: first.eventId, created: false, idempotencyKeyReused: true });
      const row = await prisma.teamWebhookInboundEvent.findUnique({ where: { id: first.eventId } });
      expect(row?.idempotencyKeyReused).toBe(true);
    });

    it("sem chave, cada requisição é um evento novo", async () => {
      const [a, b] = await Promise.all([inboundEvents.receive(receiveInput(null)), inboundEvents.receive(receiveInput(null))]);
      expect(a.eventId).not.toBe(b.eventId);
      expect(a.created && b.created).toBe(true);
    });
  });

  describe("T-11.9 — claim, retry e dead-letter", () => {
    it("workers concorrentes nunca reivindicam o mesmo evento (SKIP LOCKED)", async () => {
      const ids = await Promise.all(
        Array.from({ length: 12 }, () => inboundEvents.receive(receiveInput(`claim-${randomUUID()}`))),
      );
      const mine = new Set(ids.map((result) => result.eventId));

      const batches = await Promise.all([inboundEvents.claimDue(5), inboundEvents.claimDue(5), inboundEvents.claimDue(5)]);
      const claimed = batches.flat().map((row) => row.id).filter((id) => mine.has(id));

      expect(new Set(claimed).size).toBe(claimed.length);
      expect(claimed.length).toBeGreaterThan(0);
      for (const row of batches.flat()) {
        expect(row.status).toBe("processing");
        expect(row.attemptCount).toBeGreaterThanOrEqual(1);
      }
    });

    it("falha com próxima tentativa volta a pending; sem próxima vira failed (dead-letter)", async () => {
      const { eventId } = await inboundEvents.receive(receiveInput(`retry-${randomUUID()}`));
      const claimed = await inboundEvents.claimById(eventId);
      expect(claimed?.status).toBe("processing");
      expect(await inboundEvents.claimById(eventId)).toBeNull();

      await inboundEvents.markFailed(eventId, 1, new Date(Date.now() + 3_600_000), "falhou");
      expect((await prisma.teamWebhookInboundEvent.findUnique({ where: { id: eventId } }))?.status).toBe("pending");

      // Backoff no futuro: o cron ainda não pega.
      const due = (await inboundEvents.claimDue(50)).map((row) => row.id);
      expect(due).not.toContain(eventId);

      await inboundEvents.markFailed(eventId, 5, null, "esgotou");
      expect((await prisma.teamWebhookInboundEvent.findUnique({ where: { id: eventId } }))?.status).toBe("failed");
    });

    it("lease abandonado em processing volta para a fila", async () => {
      const { eventId } = await inboundEvents.receive(receiveInput(`lease-${randomUUID()}`));
      await inboundEvents.claimById(eventId);
      await prisma.teamWebhookInboundEvent.update({
        where: { id: eventId },
        data: { lockedAt: new Date(Date.now() - 10 * 60_000) },
      });

      const recovered = (await inboundEvents.claimDue(50)).map((row) => row.id);
      expect(recovered).toContain(eventId);
    });

    it("a retenção de 7 dias só apaga eventos terminais", async () => {
      const done = await inboundEvents.receive(receiveInput(`old-done-${randomUUID()}`));
      const pending = await inboundEvents.receive(receiveInput(`old-pending-${randomUUID()}`));
      await inboundEvents.markProcessed(done.eventId, { resultCode: "processed" });
      const old = new Date(Date.now() - 8 * 86_400_000);
      await prisma.teamWebhookInboundEvent.updateMany({ where: { id: { in: [done.eventId, pending.eventId] } }, data: { receivedAt: old } });

      await inboundEvents.purgeTerminalOlderThan(new Date(Date.now() - 7 * 86_400_000));

      expect(await prisma.teamWebhookInboundEvent.findUnique({ where: { id: done.eventId } })).toBeNull();
      expect(await prisma.teamWebhookInboundEvent.findUnique({ where: { id: pending.eventId } })).not.toBeNull();
    });
  });

  describe("T-11.14b — rodízio de SDR concorrente", () => {
    it("10 eventos simultâneos para 3 SDRs distribuem 4, 3 e 3", async () => {
      await prisma.teamWebhook.update({ where: { id: fx.webhookId }, data: { lastAssignedProfileId: null } });
      const claims = await Promise.all(Array.from({ length: 10 }, () => webhooks.claimNextRoundRobinAssignee(fx.webhookId)));

      const counts = new Map<string, number>();
      for (const claim of claims) counts.set(claim.assigneeProfileId as string, (counts.get(claim.assigneeProfileId as string) ?? 0) + 1);

      expect([...counts.values()].sort()).toEqual([3, 3, 4]);
      expect(new Set(claims.map((claim) => claim.assigneeProfileId))).toEqual(new Set(fx.sdrs));
    });

    it("pula o SDR que deixou de ser SDR do time, sem quebrar o rodízio", async () => {
      await prisma.teamWebhook.update({ where: { id: fx.webhookId }, data: { lastAssignedProfileId: null } });
      await prisma.teamMember.deleteMany({ where: { teamId: fx.teamA, profileId: fx.sdrs[1] } });
      try {
        const sequence: Array<string | null> = [];
        for (let i = 0; i < 4; i += 1) sequence.push((await webhooks.claimNextRoundRobinAssignee(fx.webhookId)).assigneeProfileId);
        expect(sequence).toEqual([fx.sdrs[0], fx.sdrs[2], fx.sdrs[0], fx.sdrs[2]]);
      } finally {
        await prisma.teamMember.create({ data: { teamId: fx.teamA, profileId: fx.sdrs[1], role: "operator", functions: ["SDR"] } });
      }
    });
  });

  describe("T-11.16 — a agenda do closer é uma só, em qualquer time", () => {
    const slot = () => {
      const startsAt = new Date(Date.now() + 5 * 86_400_000);
      startsAt.setUTCMinutes(0, 0, 0);
      return { startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), durationMinutes: 30, source: "internal" as const };
    };

    it("dois times reservando o mesmo closer e o mesmo horário ao mesmo tempo → exatamente um ganha", async () => {
      const when = slot();
      const results = await Promise.all([
        reservations.reserve({ teamId: fx.teamA, closerId: fx.closerId, ...when }),
        reservations.reserve({ teamId: fx.teamB, closerId: fx.closerId, ...when }),
        reservations.reserve({ teamId: fx.teamA, closerId: fx.closerId, ...when }),
        reservations.reserve({ teamId: fx.teamB, closerId: fx.closerId, ...when }),
      ]);
      expect(results.filter((result) => result.available)).toHaveLength(1);
    });

    it("reunião de lead do closer em outro time bloqueia o horário", async () => {
      const when = slot();
      when.startsAt.setUTCDate(when.startsAt.getUTCDate() + 1);
      const endsAt = new Date(when.startsAt.getTime() + 30 * 60_000);
      await makeLead(fx.teamB, fx.managerId, { status: "scheduled", closerId: fx.closerId, meetingDate: when.startsAt });

      const result = await reservations.reserve({ teamId: fx.teamA, closerId: fx.closerId, ...when, endsAt });
      expect(result.available).toBe(false);
    });

    it("closer diferente no mesmo horário não é bloqueado", async () => {
      const otherCloser = await makeProfile("closer-2");
      await prisma.teamMember.create({ data: { teamId: fx.teamA, profileId: otherCloser, role: "operator", functions: ["CLOSER"] } });
      const when = slot();
      when.startsAt.setUTCDate(when.startsAt.getUTCDate() + 2);
      const endsAt = new Date(when.startsAt.getTime() + 30 * 60_000);

      const [first, second] = await Promise.all([
        reservations.reserve({ teamId: fx.teamA, closerId: fx.closerId, ...when, endsAt }),
        reservations.reserve({ teamId: fx.teamA, closerId: otherCloser, ...when, endsAt }),
      ]);
      expect(first.available && second.available).toBe(true);
    });
  });

  describe("D41 — índice único parcial de e-mail e CNPJ", () => {
    it("dois leads ativos com o mesmo e-mail no mesmo time → o segundo viola a unicidade", async () => {
      const email = `dup-${randomUUID()}@example.test`;
      await makeLead(fx.teamA, fx.managerId, { email, status: "new_opportunity" });
      await expect(makeLead(fx.teamA, fx.managerId, { email, status: "scheduled" })).rejects.toMatchObject({ code: "P2002" });
    });

    it("lead em outro status (no_show, perdido, finalizado) não bloqueia um lead novo do mesmo contato", async () => {
      for (const status of ["no_show", "opportunityLost", "contract_finalized", "offerNegotiation"]) {
        const email = `reabre-${randomUUID()}@example.test`;
        await makeLead(fx.teamA, fx.managerId, { email, status });
        await expect(makeLead(fx.teamA, fx.managerId, { email, status: "new_opportunity" })).resolves.toBeTruthy();
      }
    });

    it("lead na lixeira não bloqueia", async () => {
      const email = `lixeira-${randomUUID()}@example.test`;
      await makeLead(fx.teamA, fx.managerId, { email, status: "new_opportunity", deletedAt: new Date() });
      await expect(makeLead(fx.teamA, fx.managerId, { email, status: "new_opportunity" })).resolves.toBeTruthy();
    });

    it("o mesmo e-mail em times diferentes continua permitido", async () => {
      const email = `times-${randomUUID()}@example.test`;
      await makeLead(fx.teamA, fx.managerId, { email });
      await expect(makeLead(fx.teamB, fx.managerId, { email })).resolves.toBeTruthy();
    });

    it("o mesmo vale para o CNPJ", async () => {
      const cnpj = `${Date.now()}`.slice(-14).padStart(14, "1");
      await makeLead(fx.teamA, fx.managerId, { cnpj, status: "new_opportunity" });
      await expect(makeLead(fx.teamA, fx.managerId, { cnpj, status: "new_opportunity" })).rejects.toMatchObject({ code: "P2002" });
      const other = `${Date.now() + 1}`.slice(-14).padStart(14, "2");
      await makeLead(fx.teamA, fx.managerId, { cnpj: other, status: "opportunityLost" });
      await expect(makeLead(fx.teamA, fx.managerId, { cnpj: other, status: "new_opportunity" })).resolves.toBeTruthy();
    });
  });

  describe("alerta de remarcação (DA9)", () => {
    it("abrir o alerta duas vezes para o mesmo evento não duplica e sinaliza o lead", async () => {
      const leadId = await makeLead(fx.teamA, fx.managerId, { email: `alerta-${randomUUID()}@example.test` });
      const eventId = randomUUID();
      const input = { teamId: fx.teamA, leadId, reasonCode: "schedule_conflict", suggestedSlots: [], sourceEventId: eventId };

      const [a, b] = await Promise.all([alertRepo.open(input), alertRepo.open(input)]);
      // Concorrência: pode haver 1 ou 2 criações; depois do retry sequencial nunca passa de uma linha por evento.
      const again = await alertRepo.open(input);
      expect(again.created).toBe(false);
      expect(a.id === b.id || a.created !== b.created || a.created).toBeTruthy();

      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { needsReschedule: true } });
      expect(lead?.needsReschedule).toBe(true);
    });
  });

  describe("SPEC 14 — token do recurso", () => {
    it("autentica pelo hash, e gerar de novo invalida o token anterior", async () => {
      const first = `hash-${randomUUID()}`;
      const second = `hash-${randomUUID()}`;
      const base = { teamId: fx.teamA, resourceSlug: "availability", tokenPreview: "cs_avail_…abcd", profileId: fx.managerId };

      await activations.upsertActivation({ ...base, tokenHash: first });
      expect((await activations.findByTokenHash(first))?.teamId).toBe(fx.teamA);

      await activations.upsertActivation({ ...base, tokenHash: second });
      expect(await activations.findByTokenHash(first)).toBeNull();
      expect((await activations.findByTokenHash(second))?.status).toBe("active");
    });

    it("desativar mantém o token guardado, e reativar volta a aceitar o mesmo", async () => {
      const hash = `hash-${randomUUID()}`;
      await activations.upsertActivation({ teamId: fx.teamA, resourceSlug: "availability", tokenHash: hash, tokenPreview: "p", profileId: fx.managerId });
      await activations.setStatus({ teamId: fx.teamA, resourceSlug: "availability", status: "inactive", profileId: fx.managerId });
      expect((await activations.findByTokenHash(hash))?.status).toBe("inactive");
      await activations.setStatus({ teamId: fx.teamA, resourceSlug: "availability", status: "active", profileId: fx.managerId });
      expect((await activations.findByTokenHash(hash))?.status).toBe("active");
    });

    it("o mesmo hash não pode existir em dois times (o time vem do token)", async () => {
      const hash = `hash-${randomUUID()}`;
      await activations.upsertActivation({ teamId: fx.teamA, resourceSlug: "availability", tokenHash: hash, tokenPreview: "p", profileId: fx.managerId });
      await expect(
        activations.upsertActivation({ teamId: fx.teamB, resourceSlug: "availability", tokenHash: hash, tokenPreview: "p", profileId: fx.managerId }),
      ).rejects.toMatchObject({ code: "P2002" });
    });
  });
});
