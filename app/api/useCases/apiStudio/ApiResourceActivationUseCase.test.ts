import { describe, expect, it, mock } from "bun:test";
import { hashApiResourceToken } from "@/lib/api-studio/resources";
import { ApiResourceActivationUseCase } from "./ApiResourceActivationUseCase";

const manager = { profileId: "profile-1", teamId: "team-1", role: "manager" };

function build(options: { feature?: boolean; setStatusResult?: object | null } = {}) {
  const listRecent = mock(async (_teamId: string, _slug: string, _limit: number) => [
    { id: "r1", statusCode: 200, errorCode: null, requestedDate: "2026-11-03", durationMs: 41, createdAt: new Date("2026-11-02T15:00:00.000Z") },
    { id: "r2", statusCode: 400, errorCode: "invalid_date", requestedDate: "ontem", durationMs: 3, createdAt: new Date("2026-11-02T14:00:00.000Z") },
  ]);
  const upsertActivation = mock(async (input: Record<string, unknown>) => ({ id: "a1", ...input, tokenHash: undefined }));
  const findByTeamAndSlug = mock(async () => ({ id: "a1", status: "active", tokenPreview: "cs_avail_…abcd" }) as never);
  const setStatus = mock(async () =>
    (options.setStatusResult === undefined ? { id: "a1", status: "inactive" } : options.setStatusResult) as never,
  );
  const useCase = new ApiResourceActivationUseCase({
    activations: { findByTokenHash: async () => null, findByTeamAndSlug, upsertActivation: upsertActivation as never, setStatus, touchLastUsed: async () => undefined },
    features: { hasIntegrationFeature: async () => options.feature ?? true },
    requestLogs: { listRecent },
  });
  return { useCase, upsertActivation, findByTeamAndSlug, setStatus, listRecent };
}

describe("ApiResourceActivationUseCase (SPEC 14, A-E1)", () => {
  it("T-14.1: ativar gera o token, mostra uma vez só e guarda apenas o hash", async () => {
    const { useCase, upsertActivation } = build();
    const output = await useCase.activate(manager, "availability");

    const { token } = output.result as { token: string };
    expect(output.isValid).toBe(true);
    expect(token.startsWith("cs_avail_")).toBe(true);
    const saved = upsertActivation.mock.calls[0]?.[0] as { tokenHash: string; tokenPreview: string };
    expect(saved.tokenHash).toBe(hashApiResourceToken(token));
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(saved.tokenPreview).not.toContain(token.slice(10, 40));
  });

  it("T-14.1: a leitura seguinte não devolve o token, só o preview", async () => {
    const { useCase } = build();
    const output = await useCase.get(manager, "availability");
    expect(JSON.stringify(output.result)).not.toMatch(/cs_avail_[0-9a-f]{20}/);
    expect(JSON.stringify(output.result)).toContain("tokenPreview");
  });

  it("ativar de novo rotaciona: cada ativação gera um token diferente", async () => {
    const { useCase } = build();
    const a = ((await useCase.activate(manager, "availability")).result as { token: string }).token;
    const b = ((await useCase.activate(manager, "availability")).result as { token: string }).token;
    expect(a).not.toBe(b);
  });

  it("T-14.3: quem não é manager recebe acesso negado e nada é gravado", async () => {
    const { useCase, upsertActivation } = build();
    const output = await useCase.activate({ ...manager, role: "operator" }, "availability");
    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("managers");
    expect(upsertActivation).not.toHaveBeenCalled();
  });

  it("T-14.4: time sem a feature integration não ativa", async () => {
    const { useCase, upsertActivation } = build({ feature: false });
    const output = await useCase.activate(manager, "availability");
    expect(output.isValid).toBe(false);
    expect(upsertActivation).not.toHaveBeenCalled();
  });

  it("recurso fora do catálogo não existe", async () => {
    const output = await build().useCase.activate(manager, "webhooks");
    expect(output.isValid).toBe(false);
    expect(output.errorMessages[0]).toContain("não encontrado");
  });

  it("T-14.2: desativar e reativar só mudam o status; recurso nunca ativado devolve erro claro", async () => {
    const { useCase, setStatus } = build();
    expect((await useCase.setStatus(manager, "availability", "inactive")).isValid).toBe(true);
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive", teamId: "team-1" }));

    const missing = await build({ setStatusResult: null }).useCase.setStatus(manager, "availability", "inactive");
    expect(missing.isValid).toBe(false);
    expect(missing.errorMessages[0]).toContain("ainda não foi ativado");
  });
});

describe("ApiResourceActivationUseCase.usage (SPEC 14, A-E4, T-14.16)", () => {
  it("devolve as últimas consultas do time, só com metadados", async () => {
    const { useCase, listRecent } = build();
    const output = await useCase.usage(manager, "availability");

    expect(listRecent).toHaveBeenCalledWith("team-1", "availability", 20);
    const { items } = output.result as { items: Array<Record<string, unknown>> };
    expect(items).toHaveLength(2);
    expect(Object.keys(items[0]!).sort()).toEqual(["createdAt", "durationMs", "errorCode", "id", "requestedDate", "statusCode"]);
    expect(items[0]!.createdAt).toBe("2026-11-02T15:00:00.000Z");
    expect(JSON.stringify(output.result)).not.toMatch(/cs_avail_|tokenHash/);
  });

  it("só manager de time com a feature vê o uso, e só de recurso que existe", async () => {
    const operator = await build().useCase.usage({ ...manager, role: "operator" }, "availability");
    const noFeature = await build({ feature: false }).useCase.usage(manager, "availability");
    const unknown = await build().useCase.usage(manager, "inexistente");

    expect([operator.isValid, noFeature.isValid, unknown.isValid]).toEqual([false, false, false]);
  });
});
