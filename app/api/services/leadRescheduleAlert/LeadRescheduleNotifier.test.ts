import { describe, expect, it, mock } from "bun:test";

// `lib/cache/invalidation` importa `server-only`; o notificador recebe a invalidação por injeção.
mock.module("@/lib/cache/invalidation", () => ({ invalidateNotificationsCache: () => undefined }));
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }));

const { LeadRescheduleNotifier, RESCHEDULE_REASON_LABELS } = await import("./LeadRescheduleNotifier");

function setup() {
  const createMany = mock(async (rows: unknown[]) => ({ count: rows.length }));
  const invalidate = mock((_input: { recipientProfileIds: string[] }) => undefined);
  return { createMany, invalidate, notifier: new LeadRescheduleNotifier({ createMany }, invalidate) };
}

const base = {
  teamId: "team-1",
  leadId: "lead-1",
  leadCode: "L-1",
  leadName: "Maria Souza",
  reasonCode: "schedule_conflict",
};

describe("LeadRescheduleNotifier (T-11.19)", () => {
  it("notifica SDR, closer e manager uma vez cada, mesmo quando a mesma pessoa tem dois papéis", async () => {
    const { notifier, createMany } = setup();

    const result = await notifier.notify({
      ...base,
      recipientProfileIds: ["sdr-1", "closer-1", "manager-1", "manager-1", null, undefined],
    });

    expect(result).toEqual({ createdCount: 3 });
    const rows = createMany.mock.calls[0]?.[0] as Array<{ recipientProfileId: string; type: string }>;
    expect(rows.map((row) => row.recipientProfileId)).toEqual(["sdr-1", "closer-1", "manager-1"]);
    expect(rows.every((row) => row.type === "LEAD_NEEDS_RESCHEDULE")).toBe(true);
  });

  it("a mensagem diz o motivo em linguagem clara e a metadata leva ao lead", async () => {
    const { notifier, createMany } = setup();
    await notifier.notify({ ...base, recipientProfileIds: ["sdr-1"] });

    const row = (createMany.mock.calls[0]?.[0] as Array<{ message: string; metadata: Record<string, unknown> }>)[0];
    expect(row.message).toContain("Maria Souza");
    expect(row.message).toContain(RESCHEDULE_REASON_LABELS.schedule_conflict);
    expect(row.metadata).toMatchObject({ leadId: "lead-1", reasonCode: "schedule_conflict" });
  });

  it("invalida o cache de notificações só de quem recebeu", async () => {
    const { notifier, invalidate } = setup();
    await notifier.notify({ ...base, recipientProfileIds: ["sdr-1", "closer-1"] });
    expect(invalidate).toHaveBeenCalledWith({ recipientProfileIds: ["sdr-1", "closer-1"] });
  });

  it("sem destinatário não grava nada", async () => {
    const { notifier, createMany, invalidate } = setup();
    const result = await notifier.notify({ ...base, recipientProfileIds: [null, undefined] });
    expect(result).toEqual({ createdCount: 0 });
    expect(createMany).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("motivo desconhecido cai numa mensagem genérica em vez de quebrar", async () => {
    const { notifier, createMany } = setup();
    await notifier.notify({ ...base, reasonCode: "motivo_novo", recipientProfileIds: ["sdr-1"] });
    const row = (createMany.mock.calls[0]?.[0] as Array<{ message: string }>)[0];
    expect(row.message).toContain("o horário pedido não pôde ser agendado");
  });
});
