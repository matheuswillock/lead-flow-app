import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

type CacheLifeProfile = { stale?: number; revalidate?: number; expire?: number };

const cacheLifeCalls: CacheLifeProfile[] = [];
const cacheTagCalls: string[] = [];

mock.module("next/cache", () => ({
  cacheTag: mock((tag: string) => {
    cacheTagCalls.push(tag);
  }),
  cacheLife: mock((profile: CacheLifeProfile) => {
    cacheLifeCalls.push(profile);
  }),
}));

let transactionThrows: unknown = null;

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: mock(async () => {
      if (transactionThrows) throw transactionThrows;
      return [[{ id: "p-1" }], [{ id: "p-2" }], [{ profileId: "p-1" }], 42];
    }),
    profile: { findMany: mock(() => undefined) },
    teamMember: { findMany: mock(() => undefined) },
    lead: { count: mock(() => undefined) },
  },
  withPrismaRetry: mock(async (fn: () => Promise<unknown>) => fn()),
}));

const { getCachedLandingStats, getLandingStats } = await import("./public-stats");

beforeEach(() => {
  transactionThrows = null;
  cacheLifeCalls.length = 0;
  cacheTagCalls.length = 0;
});

describe("stats disponiveis", () => {
  it("devolve o snapshot deduplicado e a vida longa", async () => {
    const entry = await getCachedLandingStats();

    expect(entry).toEqual({ status: "ok", snapshot: { activeCorretores: 2, totalLeads: 42 } });
    expect(cacheLifeCalls).toEqual([{ stale: 3600, revalidate: 3600, expire: 86400 }]);
  });
});

describe("stats indisponiveis", () => {
  it("vira entrada de cache curta em vez de propagar a falha", async () => {
    // A home e estatica: se a falha nao gravasse entrada, a pagina sairia do
    // build sem StatsBand e sem nada agendado para reconsultar. A vida curta e
    // o que faz a faixa voltar sozinha quando o banco responder.
    transactionThrows = new Error("connect ECONNREFUSED");

    const entry = await getCachedLandingStats();

    expect(entry).toEqual({ status: "unavailable" });
    expect(cacheLifeCalls).toEqual([{ stale: 60, revalidate: 60, expire: 300 }]);
  });

  it("marca a tag mesmo na falha, para o revalidateTag alcancar a entrada", async () => {
    transactionThrows = new Error("connect ECONNREFUSED");

    await getCachedLandingStats();

    expect(cacheTagCalls).toEqual(["landing-public-stats"]);
  });

  it("deixa a interrupcao de prerender subir sem virar entrada", async () => {
    transactionThrows = Object.assign(new Error("prerender interrompido"), {
      digest: "NEXT_PRERENDER_INTERRUPTED",
    });

    await expect(getCachedLandingStats()).rejects.toThrow("prerender interrompido");
    expect(cacheLifeCalls).toEqual([]);
  });
});

describe("getLandingStats", () => {
  it("achata para null, que e o sinal de esconder a secao", async () => {
    transactionThrows = new Error("connect ECONNREFUSED");

    expect(await getLandingStats()).toBeNull();
  });

  it("achata para o snapshot quando disponivel", async () => {
    expect(await getLandingStats()).toEqual({ activeCorretores: 2, totalLeads: 42 });
  });
});
