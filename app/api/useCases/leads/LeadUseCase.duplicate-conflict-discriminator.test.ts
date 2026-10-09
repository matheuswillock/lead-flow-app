import { describe, expect, it, mock } from "bun:test";
import type { ILeadRepository } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type { IProfileUseCase } from "../profiles/IProfileUseCase";

/**
 * SPEC 40 R40-3 (achado da revisão, rodada 2): `PublicLeadFormUseCase`
 * neutraliza a resposta pública quando `LeadUseCase` devolve
 * `result.isDuplicateConflict === true`. Os testes do use case público
 * passam mensagem e flag juntas no mock, então nada ali garantiria que
 * `LeadUseCase.ts` de fato emite essa flag — se ela sumisse de
 * `LeadUseCase.ts:582` (catch de unique constraint), aqueles testes
 * continuariam verdes. Este teste trava o comportamento na origem.
 */

mock.module("server-only", () => ({}));

mock.module("@/app/api/services/healthPlans/HealthPlanService", () => ({
  healthPlanService: {
    validateAndCanonicalizePlans: mock(async () => ({
      missing: [],
      canonicalByNormalized: new Map<string, string>(),
    })),
  },
}));

mock.module("@/app/api/infra/data/repositories/team/TeamRepository", () => ({
  teamRepository: {
    findMasterRef: mock(async () => ({ masterId: "manager-1" })),
  },
}));

mock.module("@/app/api/services/leadDuplicateCheck/LeadDuplicateCheckService", () => ({
  leadDuplicateCheckService: {
    // Sem candidatos no caminho de telefone/e-mail — força o fluxo a chegar
    // no `this.leadRepository.create(...)`, onde simulamos a corrida real.
    findCandidates: mock(async () => []),
  },
}));

const { LeadUseCase } = await import("./LeadUseCase");

function buildUseCase(createImpl: () => Promise<never>) {
  const findByLeadCode = mock(async () => null);
  const findCnpjConflictInTeam = mock(async () => null);
  // SPEC 40 R40-17: o catch de unique constraint de e-mail busca o lead
  // existente por `findEmailConflictInTeam` (escopo teamId), não mais por
  // `findDuplicateByManagerAndEmail` (escopo managerId, usado só pela
  // ingestão do Meta em MetaLeadUseCase).
  const findEmailConflictInTeam = mock(
    async (_input: { teamId: string; email: string; excludeLeadId?: string }) => null
  );
  const create = mock(createImpl);

  const leadRepository = {
    findByLeadCode,
    findCnpjConflictInTeam,
    findEmailConflictInTeam,
    create,
  } as unknown as ILeadRepository;

  const profileUseCase = {
    getProfileInfoBySupabaseId: mock(async () => ({ id: "profile-1", role: "manager" })),
  } as unknown as IProfileUseCase;

  return {
    useCase: new LeadUseCase(leadRepository, profileUseCase),
    findEmailConflictInTeam,
    findCnpjConflictInTeam,
  };
}

describe("LeadUseCase.createLead — discriminador isDuplicateConflict no catch de unique constraint (R40-3)", () => {
  it("email duplicado (corrida de índice único) → result.isDuplicateConflict === true", async () => {
    const { useCase } = buildUseCase(async () => {
      throw new Error(
        "Unique constraint failed on the fields: (`teamId`,`email`)"
      );
    });

    const output = await useCase.createLead(
      "supabase-1",
      { name: "Cliente Teste", phone: "11999998888", email: "duplicado@example.com" } as never,
      "team-1",
      undefined,
      { autoScheduleMeeting: false }
    );

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Ja existe um lead com este e-mail"]);
    expect((output.result as { isDuplicateConflict?: boolean } | null)?.isDuplicateConflict).toBe(true);
  });

  it("R40-17: busca do lead existente por e-mail usa teamId (não managerId), mesmo escopo do índice único que falhou", async () => {
    const { useCase, findEmailConflictInTeam } = buildUseCase(async () => {
      throw new Error(
        "Unique constraint failed on the fields: (`teamId`,`email`)"
      );
    });

    const output = await useCase.createLead(
      "supabase-1",
      { name: "Cliente Teste", phone: "11999998888", email: "duplicado@example.com" } as never,
      "team-1",
      undefined,
      { autoScheduleMeeting: false }
    );

    expect(output.isValid).toBe(false);
    expect(findEmailConflictInTeam).toHaveBeenCalledTimes(1);
    const callArg = findEmailConflictInTeam.mock.calls[0]?.[0] as
      | { teamId?: string; email?: string; managerId?: string }
      | undefined;
    // Trava o R40-17: precisa ser o teamId do lead que colidiu, não o
    // managerId do master (que pode ter outro time com o mesmo e-mail).
    expect(callArg?.teamId).toBe("team-1");
    expect(callArg?.email).toBe("duplicado@example.com");
    expect(callArg).not.toHaveProperty("managerId");
  });

  it("CNPJ duplicado (corrida de índice único) → result.isDuplicateConflict === true", async () => {
    const { useCase } = buildUseCase(async () => {
      throw new Error(
        "Unique constraint failed on the fields: (`teamId`,`cnpj`)"
      );
    });

    const output = await useCase.createLead(
      "supabase-1",
      { name: "Cliente Teste", phone: "11999998888" } as never,
      "team-1",
      undefined,
      { autoScheduleMeeting: false }
    );

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Ja existe um lead com este CNPJ"]);
    expect((output.result as { isDuplicateConflict?: boolean } | null)?.isDuplicateConflict).toBe(true);
  });

  it("outra unique constraint não mapeada → mensagem genérica, mas ainda com isDuplicateConflict === true", async () => {
    const { useCase } = buildUseCase(async () => {
      throw new Error("Unique constraint failed on the fields: (`teamId`,`someOtherField`)");
    });

    const output = await useCase.createLead(
      "supabase-1",
      { name: "Cliente Teste", phone: "11999998888" } as never,
      "team-1",
      undefined,
      { autoScheduleMeeting: false }
    );

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Ja existe um lead com estes dados unicos"]);
    expect((output.result as { isDuplicateConflict?: boolean } | null)?.isDuplicateConflict).toBe(true);
  });

  it("erro que não é unique constraint não recebe o discriminador (controle: não é sempre true)", async () => {
    const { useCase } = buildUseCase(async () => {
      throw new Error("Foreign key constraint failed on the field: managerId");
    });

    const output = await useCase.createLead(
      "supabase-1",
      { name: "Cliente Teste", phone: "11999998888" } as never,
      "team-1",
      undefined,
      { autoScheduleMeeting: false }
    );

    expect(output.isValid).toBe(false);
    expect((output.result as { isDuplicateConflict?: boolean } | null)?.isDuplicateConflict).toBeUndefined();
  });
});
