import { describe, expect, it, mock } from "bun:test";
import { generateApiResourceToken, hashApiResourceToken } from "@/lib/api-studio/resources";
import {
  ApiStudioAvailabilityUseCase,
  type AvailabilityApiBody,
  type AvailabilityApiResult,
} from "./ApiStudioAvailabilityUseCase";

// 2026-11-02 12:00 em São Paulo (UTC-3) = 15:00Z.
const NOW = new Date("2026-11-02T15:00:00.000Z");
const TZ = "America/Sao_Paulo";
const TOKEN = generateApiResourceToken("availability");

type Activation = {
  id: string;
  teamId: string;
  resourceSlug: string;
  status: "active" | "inactive";
};

const closers = [
  { profileId: "closer-ana", fullName: "Ana Lima" },
  { profileId: "closer-bia", fullName: "Bia Souza" },
];

function build(
  overrides: {
    activation?: Activation | null;
    feature?: boolean;
    account?: boolean;
    limiter?: { allowed: boolean; retryAfterSeconds: number };
    closers?: typeof closers;
    perCloser?: Record<string, string[]>;
    durationMinutes?: number;
  } = {},
) {
  const findByTokenHash = mock(async (_hash: string) =>
    overrides.activation === null
      ? null
      : ((overrides.activation ?? { id: "activation-1", teamId: "team-1", resourceSlug: "availability", status: "active" }) as never),
  );
  const touchLastUsed = mock(async (_id: string, _now: Date) => undefined);
  const getDay = mock(async (_input: { teamId: string; closerIds: string[]; date: string; timezone: string }) => ({
    durationMinutes: overrides.durationMinutes ?? 30,
    perCloser: overrides.perCloser ?? { "closer-ana": ["09:00", "14:00"], "closer-bia": [] },
  }));
  const consume = mock(async (_key: string, _options: { limit: number; windowMs: number }) =>
    overrides.limiter ?? { allowed: true, retryAfterSeconds: 0 },
  );
  const useCase = new ApiStudioAvailabilityUseCase({
    now: () => NOW,
    activations: { findByTokenHash, touchLastUsed },
    features: { hasIntegrationFeature: async () => overrides.feature ?? true },
    teams: { isAccountAllowed: async () => overrides.account ?? true, getTimezone: async () => TZ },
    closers: { listActiveClosers: async () => overrides.closers ?? closers },
    availability: { getDay },
    limiter: { consume },
  });
  return { useCase, findByTokenHash, getDay, consume, touchLastUsed };
}

const run = async (fake: ReturnType<typeof build>, date: string | null = "2026-11-03", token = TOKEN) =>
  (await fake.useCase.execute({ token, date })).result as AvailabilityApiResult;

const errorOf = (result: AvailabilityApiResult) => (result.kind === "error" ? result : null);
const bodyOf = (result: AvailabilityApiResult): AvailabilityApiBody => {
  if (result.kind !== "ok") throw new Error(`esperava sucesso, veio ${result.code}`);
  return result.body;
};

describe("API de horários — autenticação (DA2)", () => {
  it("T-14.5: token desconhecido e token de outro recurso recebem o mesmo 401", async () => {
    const unknown = errorOf(await run(build({ activation: null })));
    const otherResource = errorOf(
      await run(build({ activation: { id: "a", teamId: "team-1", resourceSlug: "outro-recurso", status: "active" } })),
    );
    expect(unknown).toMatchObject({ status: 401, code: "unauthorized" });
    expect(otherResource).toEqual(unknown!);
  });

  it("autentica pelo HASH do token: o token puro nunca chega ao repositório", async () => {
    const fake = build();
    await run(fake);
    expect(fake.findByTokenHash).toHaveBeenCalledWith(hashApiResourceToken(TOKEN));
    expect(JSON.stringify(fake.findByTokenHash.mock.calls)).not.toContain(TOKEN);
  });

  it("T-14.6: o time usado no cálculo é o da ativação do token, não há parâmetro de time", async () => {
    const fake = build({ activation: { id: "a1", teamId: "team-do-token", resourceSlug: "availability", status: "active" } });
    await run(fake);
    expect(fake.getDay.mock.calls[0]?.[0]).toMatchObject({ teamId: "team-do-token" });
  });

  it("T-14.2: recurso desativado → 403 resource_inactive (o token continua guardado)", async () => {
    const result = errorOf(
      await run(build({ activation: { id: "a", teamId: "team-1", resourceSlug: "availability", status: "inactive" } })),
    );
    expect(result).toMatchObject({ status: 403, code: "resource_inactive" });
  });

  it("T-14.4: time sem a feature integration → 403", async () => {
    expect(errorOf(await run(build({ feature: false })))).toMatchObject({ status: 403, code: "feature_unavailable" });
  });

  it("conta pausada, suspensa ou em somente leitura → 403", async () => {
    expect(errorOf(await run(build({ account: false })))).toMatchObject({ status: 403, code: "account_restricted" });
  });
});

describe("API de horários — limite e data (DA4, DA5)", () => {
  it("T-14.7: acima de 30 consultas por minuto no mesmo token → 429 com Retry-After", async () => {
    const fake = build({ limiter: { allowed: false, retryAfterSeconds: 17 } });
    const result = errorOf(await run(fake));
    expect(result).toMatchObject({ status: 429, code: "rate_limited", retryAfterSeconds: 17 });
    expect(fake.consume).toHaveBeenCalledWith("api:res:activation-1", { limit: 30, windowMs: 60_000 });
    expect(fake.getDay).not.toHaveBeenCalled();
  });

  it("T-14.13: formato inválido → invalid_date; fora da janela → date_out_of_range", async () => {
    for (const date of [null, "", "2026-1-3", "03/11/2026", "2026-02-31", "amanhã"]) {
      expect(errorOf(await run(build(), date))).toMatchObject({ status: 400, code: "invalid_date" });
    }
    expect(errorOf(await run(build(), "2026-11-01"))).toMatchObject({ status: 400, code: "date_out_of_range" });
    expect(errorOf(await run(build(), "2027-05-02"))).toMatchObject({ status: 400, code: "date_out_of_range" });
  });

  it("aceita hoje e o último dia da janela de 180 dias", async () => {
    expect((await run(build(), "2026-11-02")).kind).toBe("ok");
    expect((await run(build(), "2027-05-01")).kind).toBe("ok");
  });

  it("não calcula nada quando a data é inválida", async () => {
    const fake = build();
    await run(fake, "lixo");
    expect(fake.getDay).not.toHaveBeenCalled();
  });
});

describe("API de horários — resposta (contrato do guia)", () => {
  it("devolve data, fuso, slot_minutes e todos os closers, inclusive o que não tem horário (slots: [])", async () => {
    const body = bodyOf(await run(build()));
    expect(body.date).toBe("2026-11-03");
    expect(body.timezone).toBe(TZ);
    expect(body.slot_minutes).toBe(30);
    expect(body.closers.map((closer) => closer.closer_id)).toEqual(["closer-ana", "closer-bia"]);
    expect(body.closers[1].slots).toEqual([]);
  });

  it("T-14.14: todo horário sai com offset, no fuso do time", async () => {
    const body = bodyOf(await run(build()));
    expect(body.closers[0].slots[0]).toEqual({
      starts_at: "2026-11-03T09:00:00-03:00",
      ends_at: "2026-11-03T09:30:00-03:00",
    });
    expect(body.generated_at).toBe("2026-11-02T12:00:00-03:00");
  });

  it("slot_minutes e o fim do horário seguem a duração configurada no time", async () => {
    const body = bodyOf(await run(build({ durationMinutes: 45, perCloser: { "closer-ana": ["09:00"], "closer-bia": [] } })));
    expect(body.slot_minutes).toBe(45);
    expect(body.closers[0].slots[0].ends_at).toBe("2026-11-03T09:45:00-03:00");
  });

  it("para hoje, só aparecem horários a partir de agora + 5 minutos", async () => {
    // Agora = 12:00 em SP. 12:00 e 12:04 ficam de fora; 12:05 entra.
    const body = bodyOf(
      await run(build({ perCloser: { "closer-ana": ["11:30", "12:00", "12:05", "14:00"], "closer-bia": [] } }), "2026-11-02"),
    );
    expect(body.closers[0].slots.map((slot) => slot.starts_at)).toEqual([
      "2026-11-02T12:05:00-03:00",
      "2026-11-02T14:00:00-03:00",
    ]);
  });

  it("T-14.12: só id e nome do closer e intervalos livres (nada de e-mail, avatar ou dado de lead)", async () => {
    const body = bodyOf(await run(build()));
    expect(Object.keys(body).sort()).toEqual(["closers", "date", "generated_at", "slot_minutes", "timezone"]);
    expect(Object.keys(body.closers[0]).sort()).toEqual(["closer_id", "name", "slots"]);
    expect(Object.keys(body.closers[0].slots[0]).sort()).toEqual(["ends_at", "starts_at"]);
  });

  it("time sem closers devolve a lista vazia, sem consultar disponibilidade", async () => {
    const fake = build({ closers: [] });
    const body = bodyOf(await run(fake));
    expect(body.closers).toEqual([]);
    expect(fake.getDay).not.toHaveBeenCalled();
  });

  it("registra o último uso do token", async () => {
    const fake = build();
    await run(fake);
    expect(fake.touchLastUsed).toHaveBeenCalledWith("activation-1", NOW);
  });
});
