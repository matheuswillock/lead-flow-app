import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock.module("server-only", () => ({}));

const declaredTags: string[] = [];

mock.module("next/cache", () => ({
  cacheTag: mock((tag: string) => {
    declaredTags.push(tag);
  }),
  cacheLife: mock(() => undefined),
}));

/**
 * Stub do service para o caminho cacheado nao tocar o Prisma. A instancia precisa
 * vir desta classe porque MetricsUseCase so usa o cache quando o service injetado
 * e identico ao singleton default construido no modulo.
 */
const getDashboardMetricsMock = mock(
  async (_filters: { teamIds?: string[] }, _ctx?: unknown) => ({ totalLeads: 0 })
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
  teamMember: { role: "manager", functions: ["SDR"] },
};

function baseFilters(overrides: Record<string, unknown> = {}) {
  return {
    supabaseId: "profile-1",
    teamId: "team-active",
    period: "30d" as const,
    ...overrides,
  };
}

beforeEach(() => {
  declaredTags.length = 0;
});

describe("getCachedDashboardMetrics — tags declaradas", () => {
  it("escopo 'active' declara apenas a tag do time ativo", async () => {
    await metricsUseCase.getDashboardMetrics(baseFilters({ teamScope: "active" }), ctx);

    expect(declaredTags).toEqual(["team-dashboard:team-active"]);
  });

  it("escopo 'all' declara accountDashboard E a tag de cada time agregado", async () => {
    await metricsUseCase.getDashboardMetrics(
      baseFilters({
        teamScope: "all",
        masterId: "master-1",
        teamIds: ["team-b", "team-a"],
      }),
      ctx
    );

    // team-dashboard:team-active sempre entra; as tags agregadas tornam a entrada
    // de conta alcancavel pelos sites de invalidacao de lead ja existentes.
    expect(new Set(declaredTags)).toEqual(
      new Set([
        "team-dashboard:team-active",
        "account-dashboard:master-1",
        "team-dashboard:team-a",
        "team-dashboard:team-b",
      ])
    );
  });

  it("acima do teto de times cai so em accountDashboard e avisa", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    const teamIds = Array.from({ length: 51 }, (_, index) => `team-${index}`);

    await metricsUseCase.getDashboardMetrics(
      baseFilters({ teamScope: "all", masterId: "master-1", teamIds }),
      ctx
    );

    expect(declaredTags).toEqual(["team-dashboard:team-active", "account-dashboard:master-1"]);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });
});

describe("teamIds na chave de cache", () => {
  it("ordena teamIds para que [a,b] e [b,a] nao gerem duas entradas", async () => {
    await metricsUseCase.getDashboardMetrics(
      baseFilters({ teamScope: "all", masterId: "master-1", teamIds: ["team-b", "team-a"] }),
      ctx
    );
    const firstCallTeamIds = getDashboardMetricsMock.mock.calls.at(-1)?.[0]?.teamIds;

    await metricsUseCase.getDashboardMetrics(
      baseFilters({ teamScope: "all", masterId: "master-1", teamIds: ["team-a", "team-b"] }),
      ctx
    );
    const secondCallTeamIds = getDashboardMetricsMock.mock.calls.at(-1)?.[0]?.teamIds;

    expect(firstCallTeamIds).toEqual(["team-a", "team-b"]);
    expect(secondCallTeamIds).toEqual(["team-a", "team-b"]);
  });

  it("nao muta o array recebido no filtro", async () => {
    const teamIds = ["team-b", "team-a"];

    await metricsUseCase.getDashboardMetrics(
      baseFilters({ teamScope: "all", masterId: "master-1", teamIds }),
      ctx
    );

    expect(teamIds).toEqual(["team-b", "team-a"]);
  });
});
