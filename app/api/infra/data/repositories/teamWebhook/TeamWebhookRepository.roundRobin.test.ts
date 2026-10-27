import { beforeEach, describe, expect, it, mock } from "bun:test";

type Args = Record<string, unknown>;

let webhookRow: { teamId: string; defaultAssigneeProfileIds: string[]; lastAssignedProfileId: string | null } | null;
const queryRawMock = mock(async (..._args: unknown[]) => (webhookRow ? [webhookRow] : []));
const memberFindManyMock = mock(async (_args: Args) => [] as Array<{ profileId: string }>);
const webhookUpdateMock = mock(async (_args: Args) => ({}));

const tx = {
  $queryRaw: queryRawMock,
  teamMember: { findMany: memberFindManyMock },
  teamWebhook: { update: webhookUpdateMock },
};

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
}));

const { TeamWebhookRepository } = await import("./TeamWebhookRepository");

const SDRS = ["sdr-a", "sdr-b", "sdr-c"];

describe("TeamWebhookRepository.claimNextRoundRobinAssignee — rodízio atômico (DA11)", () => {
  beforeEach(() => {
    webhookRow = { teamId: "team-1", defaultAssigneeProfileIds: SDRS, lastAssignedProfileId: null };
    queryRawMock.mockClear();
    memberFindManyMock.mockReset();
    memberFindManyMock.mockResolvedValue(SDRS.map((profileId) => ({ profileId })));
    webhookUpdateMock.mockClear();
  });

  it("trava a linha do webhook (FOR UPDATE) antes de ler o ponteiro", async () => {
    await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    const sql = (queryRawMock.mock.calls[0]?.[0] as { strings?: string[] } | string[]).toString();
    expect(sql).toContain("FOR UPDATE");
  });

  it("escolhe o primeiro SDR e avança o ponteiro na mesma transação", async () => {
    const result = await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    expect(result).toEqual({ assigneeProfileId: "sdr-a", listConfigured: true });
    expect(webhookUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "webhook-1" },
      data: { lastAssignedProfileId: "sdr-a" },
    });
  });

  it("vai para o SDR seguinte ao último atendido", async () => {
    webhookRow = { teamId: "team-1", defaultAssigneeProfileIds: SDRS, lastAssignedProfileId: "sdr-a" };
    const result = await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    expect(result.assigneeProfileId).toBe("sdr-b");
  });

  it("só considera SDR ativo do time: consulta membros com a função SDR e perfil não deletado", async () => {
    await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    expect(memberFindManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: {
        teamId: "team-1",
        profileId: { in: SDRS },
        functions: { has: "SDR" },
        profile: { deletedAt: null },
      },
    });
  });

  it("pula o SDR que saiu do time (T-11.14c)", async () => {
    webhookRow = { teamId: "team-1", defaultAssigneeProfileIds: SDRS, lastAssignedProfileId: "sdr-a" };
    memberFindManyMock.mockResolvedValue([{ profileId: "sdr-a" }, { profileId: "sdr-c" }]);
    const result = await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    expect(result.assigneeProfileId).toBe("sdr-c");
  });

  it("lista configurada mas sem nenhum SDR válido: sem responsável, ponteiro intacto", async () => {
    memberFindManyMock.mockResolvedValue([]);
    const result = await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    expect(result).toEqual({ assigneeProfileId: null, listConfigured: true });
    expect(webhookUpdateMock).not.toHaveBeenCalled();
  });

  it("webhook sem lista de SDRs: nada a distribuir", async () => {
    webhookRow = { teamId: "team-1", defaultAssigneeProfileIds: [], lastAssignedProfileId: null };
    const result = await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-1");
    expect(result).toEqual({ assigneeProfileId: null, listConfigured: false });
    expect(memberFindManyMock).not.toHaveBeenCalled();
  });

  it("webhook inexistente: nada a distribuir", async () => {
    webhookRow = null;
    const result = await new TeamWebhookRepository().claimNextRoundRobinAssignee("webhook-x");
    expect(result).toEqual({ assigneeProfileId: null, listConfigured: false });
  });
});
