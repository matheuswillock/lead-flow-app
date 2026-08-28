import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

mock.module("next/cache", () => ({
  cacheTag: mock(() => undefined),
  cacheLife: mock(() => undefined),
}));

const getDashboardMetricsMock = mock(
  async (_filters: { startDate?: Date; endDate?: Date }, _ctx?: unknown) => ({ totalLeads: 0 })
);

mock.module("@/app/api/services/DashboardInfos/DashboardInfosService", () => ({
  DashboardInfosService: class {
    getDashboardMetrics = getDashboardMetricsMock;
  },
}));

const { metricsUseCase } = await import("./MetricsUseCase");

const ctx = {
  profileId: "profile-1",
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] as string[] },
};

function filters() {
  return { supabaseId: "profile-1", teamId: "team-1", period: "30d" as const };
}

beforeEach(() => {
  getDashboardMetricsMock.mockClear();
});

/**
 * As datas resolvidas viram argumento de `getCachedDashboardMetrics`, ou seja,
 * chave de cache. Um `new Date()` cru daria precisao de milissegundo: chave
 * nova a cada request, cache que nunca da hit e uma entrada gravada por chamada.
 */
describe("estabilidade da chave de cache do dashboard", () => {
  it("duas chamadas seguidas resolvem as mesmas datas", async () => {
    await metricsUseCase.getDashboardMetrics(filters(), ctx);
    const primeira = getDashboardMetricsMock.mock.calls.at(-1)?.[0];

    await metricsUseCase.getDashboardMetrics(filters(), ctx);
    const segunda = getDashboardMetricsMock.mock.calls.at(-1)?.[0];

    expect(primeira?.startDate?.toISOString()).toBe(segunda?.startDate?.toISOString());
    expect(primeira?.endDate?.toISOString()).toBe(segunda?.endDate?.toISOString());
  });

  it("as datas caem em fronteira de dia, sem resto de milissegundo", async () => {
    await metricsUseCase.getDashboardMetrics(filters(), ctx);
    const usadas = getDashboardMetricsMock.mock.calls.at(-1)?.[0];

    // Fronteira de dia no fuso do usuario: o instante UTC nao e meia-noite,
    // mas os milissegundos tem que ser deterministicos (000 ou 999).
    const msInicio = usadas?.startDate?.getMilliseconds() ?? -1;
    const msFim = usadas?.endDate?.getMilliseconds() ?? -1;

    expect([0, 999]).toContain(msInicio);
    expect([0, 999]).toContain(msFim);
  });

  it("respeita datas explicitas do caller sem arredondar", async () => {
    const startDate = new Date("2026-08-01T13:37:42.123Z");
    const endDate = new Date("2026-08-15T09:11:05.456Z");

    await metricsUseCase.getDashboardMetrics({ ...filters(), startDate, endDate }, ctx);
    const usadas = getDashboardMetricsMock.mock.calls.at(-1)?.[0];

    expect(usadas?.startDate?.toISOString()).toBe(startDate.toISOString());
    expect(usadas?.endDate?.toISOString()).toBe(endDate.toISOString());
  });
});
