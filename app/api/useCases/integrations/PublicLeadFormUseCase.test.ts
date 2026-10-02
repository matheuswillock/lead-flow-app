import { describe, expect, it, mock, beforeEach } from "bun:test";
import { UserFunction } from "@prisma/client";
import { Output } from "@/lib/output";

/**
 * SPEC 40 A-E2 (V8, DA2/DA3): a rota pública de leads não pode confirmar se
 * um lead já existia (duplicata por telefone, e-mail ou CNPJ), nem devolver
 * e-mail de membro do time no bootstrap. `PublicLeadFormUseCase.ts` está no
 * `dipPrismaInUseCaseAllowlist` (`.governance/ai-governance.config.json`) —
 * instancia Prisma e o `LeadUseCase` diretamente em vez de receber por DI.
 * Por isso este teste mocka os módulos (prisma, LeadUseCase, serviços) em vez
 * de injetar dependências, seguindo o mesmo padrão de
 * `StudioWebhookIntegrationUseCase.test.ts`.
 */

const TEAM_ID = "11111111-1111-1111-1111-111111111111";
const SDR_ID = "22222222-2222-2222-2222-222222222222";
const MASTER_ID = "33333333-3333-3333-3333-333333333333";

const createLeadMock = mock(async () => new Output(true, [], [], { id: "lead-1", leadCode: "T0001A" }));

const prismaMock = {
    team: {
      findUnique: mock(async () => ({
        id: TEAM_ID,
        name: "Time Teste",
        masterId: MASTER_ID,
        master: { id: MASTER_ID, supabaseId: "supabase-master-1", timezone: "America/Sao_Paulo" },
      })),
    },
    teamMember: {
      findUnique: mock(async () => ({ functions: [UserFunction.SDR, UserFunction.CLOSER] })),
      // R40-11: os fixtures incluem `email` mesmo o `select` real de
      // `listTeamMembersSnapshot` não pedindo mais esse campo — prova que
      // `mapMembersToAssignableOptions` não devolve e-mail mesmo que o dado
      // exista na linha (defesa em profundidade, não só "o mock não tem o
      // campo"). Se o fallback `fullName || email` voltasse, o teste do
      // membro sem `fullName` pegaria.
      findMany: mock(async () => [
        {
          profileId: "member-1",
          functions: [UserFunction.CLOSER],
          profile: {
            id: "member-1",
            fullName: "Closer Um",
            email: "closer.um@example.com",
            profileIconUrl: null,
          },
        },
        {
          profileId: "member-2",
          functions: [UserFunction.SDR],
          profile: {
            id: "member-2",
            fullName: null,
            email: "membro.sem.nome@example.com",
            profileIconUrl: null,
          },
        },
      ]),
    },
    teamTransferRoute: {
      count: mock(async () => 0),
    },
    healthPlanOption: {
      findMany: mock(async () => []),
    },
};

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
  withPrismaRetry: async <T,>(fn: () => Promise<T>) => fn(),
}));

mock.module("@/app/api/infra/data/repositories/lead/LeadRepository", () => ({
  LeadRepository: class {},
}));

mock.module("@/app/api/useCases/profiles/ProfileUseCase", () => ({
  RegisterNewUserProfile: class {},
}));

const leadActivityCreateMock = mock(async (_data: { leadId: string; type: string; body: string; payload?: unknown }) => ({
  id: "activity-1",
}));
mock.module("@/app/api/infra/data/repositories/leadActivity/LeadActivityRepository", () => ({
  leadActivityRepository: { create: leadActivityCreateMock },
}));

mock.module("@/app/api/useCases/leads/LeadUseCase", () => ({
  LeadUseCase: class {
    createLead(...args: unknown[]) {
      return createLeadMock(...(args as []));
    }
  },
}));

mock.module("@/app/api/services/leadCustomField/LeadCustomFieldService", () => ({
  leadCustomFieldService: {
    listActivePublicDefinitionsByTeamId: mock(async () => []),
  },
}));

// Não exercitados pelos testes abaixo (nenhum payload agenda reunião), mas
// importados por `PublicLeadFormUseCase.ts` no topo do módulo — mockados só
// para não carregar a árvore real (Supabase admin, `server-only`, etc).
mock.module("@/app/api/services/leadSchedule/LeadScheduleService", () => ({
  leadScheduleService: { createSchedule: mock(async () => new Output(true, [], [], {})) },
}));
mock.module("@/app/api/services/googleCalendar/GoogleCalendarService", () => ({
  getCalendarBusyIntervals: mock(async () => []),
}));
mock.module("@/app/api/services/preSchedule/PreScheduleSlotService", () => ({
  getPreScheduleSlotsPayload: mock(async () => ({})),
}));
mock.module("@/lib/google/connection", () => ({
  isGoogleConnectionActive: mock(() => false),
}));

const { PublicLeadFormUseCase } = await import("./PublicLeadFormUseCase");

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    teamId: TEAM_ID,
    name: "Fulano de Tal",
    phone: "11999998888",
    assignedTo: SDR_ID,
    ...overrides,
  } as Parameters<InstanceType<typeof PublicLeadFormUseCase>["createPublicLead"]>[0];
}

describe("PublicLeadFormUseCase.createPublicLead — resposta neutra (SPEC 40 DA2, T-40.3/T-40.4)", () => {
  beforeEach(() => {
    createLeadMock.mockClear();
    leadActivityCreateMock.mockClear();
  });

  it("telefone repetido: resposta neutra, sem id, nome, telefone, e-mail ou status do lead existente (T-40.3)", async () => {
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Possível lead duplicado neste time"], {
        requiresDuplicateConfirmation: true,
        existingLeadId: "existing-lead-1",
        duplicateCandidates: [
          {
            id: "existing-lead-1",
            name: "Cliente Existente",
            phone: "11999998888",
            email: "existente@example.com",
            status: "new_opportunity",
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );

    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest());

    expect(output.isValid).toBe(true);
    expect(output.result).toBeNull();
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("existing-lead-1");
    expect(serialized).not.toContain("Cliente Existente");
    expect(serialized).not.toContain("existente@example.com");
    expect(serialized).not.toContain("new_opportunity");
    expect(serialized).not.toContain("requiresDuplicateConfirmation");

    // SPEC 40 D25: nenhum lead novo nasce, mas o existente recebe atividade.
    expect(leadActivityCreateMock).toHaveBeenCalledTimes(1);
    const activityCall = leadActivityCreateMock.mock.calls[0]?.[0] as {
      leadId: string;
      body: string;
      payload: { kind: string; submittedData: { phone: string } };
    };
    expect(activityCall.leadId).toBe("existing-lead-1");
    expect(activityCall.body).toBe("Novo envio pelo formulário público");
    expect(activityCall.payload.kind).toBe("duplicate_submission");
    expect(activityCall.payload.submittedData.phone).toBe("11999998888");
  });

  it("e-mail repetido: mesma resposta neutra de um lead novo, com atividade no lead existente (T-40.4)", async () => {
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Já existe um lead com este e-mail neste time"], {
        isDuplicateConflict: true,
        existingLeadId: "existing-lead-2",
      })
    );

    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest({ email: "duplicado@example.com" }));

    expect(output.isValid).toBe(true);
    expect(output.result).toBeNull();
    expect(output.successMessages).toEqual(["Lead cadastrado com sucesso!"]);
    expect(JSON.stringify(output)).not.toContain("Já existe");
    expect(leadActivityCreateMock).toHaveBeenCalledTimes(1);
    expect((leadActivityCreateMock.mock.calls[0]?.[0] as { leadId: string }).leadId).toBe(
      "existing-lead-2"
    );
  });

  it("duplicata sem existingLeadId resolvido (best-effort da corrida): resposta ainda neutra, sem tentar registrar atividade", async () => {
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Ja existe um lead com estes dados unicos"], {
        isDuplicateConflict: true,
        existingLeadId: null,
      })
    );

    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest());

    expect(output.isValid).toBe(true);
    expect(output.result).toBeNull();
    expect(leadActivityCreateMock).not.toHaveBeenCalled();
  });

  it("CNPJ repetido (pre-check com discriminador isDuplicateConflict): mesma resposta neutra, mesmo com nome/leadCode do lead existente na mensagem interna (T-40.4)", async () => {
    createLeadMock.mockImplementationOnce(async () =>
      new Output(
        false,
        [],
        ["Já existe um lead com este CNPJ neste time (LEAD-9999, Empresa Existente LTDA)"],
        // Discriminador real emitido por `LeadUseCase.ts` (pre-check de
        // CNPJ) desde o R40-3 — não depende só do texto da mensagem.
        { isDuplicateConflict: true, existingLeadId: "existing-lead-3" }
      )
    );

    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest({ cnpj: "11222333000181" }));

    expect(output.isValid).toBe(true);
    expect(output.result).toBeNull();
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("LEAD-9999");
    expect(serialized).not.toContain("Empresa Existente LTDA");
    expect((leadActivityCreateMock.mock.calls[0]?.[0] as { leadId: string }).leadId).toBe(
      "existing-lead-3"
    );
  });

  it("R40-3: variante SEM acento emitida pelo catch de unique constraint dentro de LeadUseCase (e-mail/CNPJ/dados) também recebe a resposta neutra", async () => {
    // Achado do revisor: `LeadUseCase.createLeadInternal` já captura P2002
    // internamente (nunca lança) e devolve texto sem acento e sem "neste
    // time" — diferente do que `PublicLeadFormUseCase` produzia no próprio
    // catch (que é, na prática, inatingível por este caminho). Sem o
    // discriminador `isDuplicateConflict` (ou o prefixo sem acento), essa
    // resposta vazava "Ja existe um lead com este e-mail" com 400.
    const variants = [
      ["Ja existe um lead com este e-mail", { isDuplicateConflict: true }],
      ["Ja existe um lead com este CNPJ", { isDuplicateConflict: true }],
      ["Ja existe um lead com estes dados unicos", { isDuplicateConflict: true }],
    ] as const;

    for (const [message, result] of variants) {
      createLeadMock.mockImplementationOnce(async () => new Output(false, [], [message], result));

      const useCase = new PublicLeadFormUseCase();
      // eslint-disable-next-line no-await-in-loop
      const output = await useCase.createPublicLead(makeRequest());

      expect(output.isValid).toBe(true);
      expect(output.result).toBeNull();
      expect(JSON.stringify(output)).not.toContain(message);
    }
  });

  it("corrida de índice único (catch do Prisma) também recebe a resposta neutra (T-40.4)", async () => {
    createLeadMock.mockImplementationOnce(async () => {
      throw new Error(
        'Unique constraint failed on the fields: (`teamId`,`email`) — lead-99, cliente@example.com'
      );
    });

    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest({ email: "cliente@example.com" }));

    expect(output.isValid).toBe(true);
    expect(output.result).toBeNull();
    expect(JSON.stringify(output)).not.toContain("cliente@example.com");
  });

  it("lead novo (sem duplicata) continua criando normalmente, sem registrar atividade de duplicata", async () => {
    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest());

    expect(output.isValid).toBe(true);
    expect((output.result as { id?: string } | null)?.id).toBe("lead-1");
    expect(leadActivityCreateMock).not.toHaveBeenCalled();
  });

  it("erro de validação genuíno (não relacionado a duplicata) continua sendo repassado ao chamador", async () => {
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Plano de saúde inválido: Plano Fantasma"], null)
    );

    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.createPublicLead(makeRequest());

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Plano de saúde inválido: Plano Fantasma"]);
  });
});

describe("PublicLeadFormUseCase.getPublicFormBootstrap — sem e-mail de membro (SPEC 40 DA3, T-40.5)", () => {
  it("não contém e-mail de nenhum membro do time, nem lista guestCandidates", async () => {
    const useCase = new PublicLeadFormUseCase();
    const output = await useCase.getPublicFormBootstrap(TEAM_ID);

    expect(output.isValid).toBe(true);
    const result = output.result as {
      closers: Array<{ id: string; name: string }>;
      sdrs: Array<{ id: string; name: string }>;
      guestCandidates?: unknown;
    };

    expect(result.guestCandidates).toBeUndefined();
    expect(result.closers.some((closer) => closer.name.includes("@"))).toBe(false);
    expect(result.sdrs.some((sdr) => sdr.name.includes("@"))).toBe(false);
    // O fixture do membro sem fullName não deve cair para e-mail no nome.
    expect(result.sdrs.find((sdr) => sdr.id === "member-2")?.name).toBe("Membro do time");
    // R40-11: os e-mails dos fixtures existem na linha do banco (mock) —
    // provar que eles não aparecem em NENHUM lugar da saída serializada,
    // não só no campo `name`.
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("closer.um@example.com");
    expect(serialized).not.toContain("membro.sem.nome@example.com");
  });
});
