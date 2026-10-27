import { describe, expect, it, mock } from "bun:test";

mock.module("@/lib/cache/invalidation", () => ({ invalidateNotificationsCache: () => undefined }));
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }));

const { LeadRescheduleAlertService } = await import("./LeadRescheduleAlertService");

const input = {
  teamId: "team-1",
  leadId: "lead-1",
  leadCode: "L-1",
  leadName: "Maria Souza",
  reasonCode: "schedule_conflict",
  requestedStartsAt: new Date("2026-11-03T14:00:00.000Z"),
  requestedCloserId: "closer-1",
  suggestedSlots: [],
  sourceEventId: "event-1",
  recipientProfileIds: ["sdr-1", "closer-1", "manager-1"],
};

function setup(overrides: { created?: boolean; notifyError?: Error } = {}) {
  const open = mock(async () => ({ id: "alert-1", created: overrides.created ?? true }));
  const notify = mock(async () => {
    if (overrides.notifyError) throw overrides.notifyError;
    return { createdCount: 3 };
  });
  return { open, notify, service: new LeadRescheduleAlertService({ open }, { notify }) };
}

describe("LeadRescheduleAlertService.flag", () => {
  it("abre o alerta e notifica quem precisa agir", async () => {
    const { service, open, notify } = setup();
    const result = await service.flag(input);

    expect(result).toEqual({ alertId: "alert-1", created: true, notified: true });
    expect(open).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-1", reasonCode: "schedule_conflict", recipientProfileIds: input.recipientProfileIds }),
    );
  });

  it("retry do mesmo evento: alerta já existia, ninguém é notificado de novo", async () => {
    const { service, notify } = setup({ created: false });
    const result = await service.flag(input);
    expect(result).toEqual({ alertId: "alert-1", created: false, notified: false });
    expect(notify).not.toHaveBeenCalled();
  });

  it("falha ao notificar não desfaz o alerta: o lead segue sinalizado", async () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      const { service } = setup({ notifyError: new Error("push indisponível") });
      const result = await service.flag(input);
      expect(result).toEqual({ alertId: "alert-1", created: true, notified: false });
    } finally {
      console.error = original;
    }
  });
});
