import { describe, expect, it, mock } from "bun:test";
import { Output } from "@/lib/output";

const META_LEAD_DATA = {
  leadgenId: "leadgen-1",
  createdTime: "2026-07-24T00:00:00.000Z",
  formId: "form-1",
  adId: "ad-1",
  name: "Lead Meta",
  email: "lead-meta@example.com",
  phone: "21999999999",
  age: "30",
  currentHealthPlan: "Amil",
  city: "Rio de Janeiro",
  notes: "Vindo do Meta",
  rawData: {},
};

const getLeadDataMock = mock(async () => META_LEAD_DATA);
mock.module("@/app/api/services/MetaLeadService", () => ({
  metaLeadService: { getLeadData: getLeadDataMock },
}));

mock.module("@/app/api/services/healthPlans/HealthPlanService", () => ({
  healthPlanService: {
    resolvePlanNameFromText: mock(async (text: string) => text),
  },
}));

const createLeadMock = mock(async () =>
  new Output(true, [], [], { id: "lead-1" })
);
mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: { createLead: createLeadMock },
}));

const profileFindUniqueMock = mock(
  async () => ({ id: "manager-1", supabaseId: "supabase-1" }) as { id: string; supabaseId: string | null }
);
const teamFindFirstMock = mock(async () => ({ id: "team-1" }));
const leadFindFirstMock = mock(async () => null as { id: string } | null);
const leadUpdateMock = mock(async () => ({ id: "existing-lead-1" }));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUniqueMock, findFirst: mock(async () => null) },
    team: { findFirst: teamFindFirstMock },
    lead: { findFirst: leadFindFirstMock, update: leadUpdateMock },
  },
}));

const { MetaLeadUseCase } = await import("./MetaLeadUseCase");

describe("MetaLeadUseCase.processMetaLead (D2)", () => {
  it("cria lead novo via leadUseCase.createLead com originChannel: meta_webhook", async () => {
    createLeadMock.mockClear();
    leadFindFirstMock.mockClear();
    leadUpdateMock.mockClear();
    leadFindFirstMock.mockImplementationOnce(async () => null);

    const useCase = new MetaLeadUseCase();
    const output = await useCase.processMetaLead("leadgen-1", "manager-1");

    expect(output.isValid).toBe(true);
    expect(createLeadMock).toHaveBeenCalledTimes(1);
    expect(leadUpdateMock).not.toHaveBeenCalled();

    const [supabaseId, data, teamId] = createLeadMock.mock.calls[0] as unknown[];
    expect(supabaseId).toBe("supabase-1");
    expect(teamId).toBe("team-1");
    expect((data as { originChannel?: string }).originChannel).toBe("meta_webhook");
    expect((data as { confirmDuplicate?: boolean }).confirmDuplicate).toBe(true);
  });

  it("preserva o dedupe silencioso por e-mail: nunca chama createLead quando já existe lead", async () => {
    createLeadMock.mockClear();
    leadFindFirstMock.mockClear();
    leadUpdateMock.mockClear();
    leadFindFirstMock.mockImplementationOnce(async () => ({ id: "existing-lead-1" }));

    const useCase = new MetaLeadUseCase();
    const output = await useCase.processMetaLead("leadgen-1", "manager-1");

    expect(output.isValid).toBe(true);
    expect(createLeadMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).toHaveBeenCalledTimes(1);
    expect((output.result as { id: string }).id).toBe("existing-lead-1");
  });

  it("retorna erro sem criar lead quando o manager não tem supabaseId", async () => {
    createLeadMock.mockClear();
    profileFindUniqueMock.mockClear();
    profileFindUniqueMock.mockImplementationOnce(async () => ({ id: "manager-1", supabaseId: null }));

    const useCase = new MetaLeadUseCase();
    const output = await useCase.processMetaLead("leadgen-1", "manager-1");

    expect(output.isValid).toBe(false);
    expect(createLeadMock).not.toHaveBeenCalled();
  });

  it("propaga falha de leadUseCase.createLead como Output inválido", async () => {
    createLeadMock.mockClear();
    leadFindFirstMock.mockClear();
    leadFindFirstMock.mockImplementationOnce(async () => null);
    createLeadMock.mockImplementationOnce(async () => new Output(false, [], ["Erro ao criar lead"], null));

    const useCase = new MetaLeadUseCase();
    const output = await useCase.processMetaLead("leadgen-1", "manager-1");

    expect(output.isValid).toBe(false);
  });
});
