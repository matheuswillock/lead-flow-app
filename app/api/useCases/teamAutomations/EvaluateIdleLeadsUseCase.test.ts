import { describe, expect, it, mock, beforeEach } from "bun:test";

const mockFindAllEnabled = mock(async () => [] as unknown[]);
const mockDispatch = mock(async () => undefined);
const mockFindMany = mock(async () => [] as unknown[]);

mock.module("@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository", () => ({
  teamAutomationRuleRepository: {
    findAllEnabledByTrigger: mockFindAllEnabled,
  },
}));

mock.module("@/app/api/services/teamAutomation/TeamAutomationDispatcherService", () => ({
  teamAutomationDispatcherService: {
    dispatch: mockDispatch,
  },
}));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    lead: {
      findMany: mockFindMany,
    },
  },
}));

const { EvaluateIdleLeadsUseCase } = await import(
  "@/app/api/useCases/teamAutomations/EvaluateIdleLeadsUseCase"
);

describe("EvaluateIdleLeadsUseCase", () => {
  beforeEach(() => {
    mockFindAllEnabled.mockReset();
    mockDispatch.mockReset();
    mockFindMany.mockReset();

    mockFindAllEnabled.mockImplementation(async () => []);
    mockDispatch.mockImplementation(async () => undefined);
    mockFindMany.mockImplementation(async () => []);
  });

  it("calcula limiar em dias e despacha leads elegíveis", async () => {
    const enteredAt = new Date("2026-01-01T10:00:00.000Z");

    mockFindAllEnabled.mockImplementation(async () => [
      {
        id: "rule-1",
        teamId: "team-1",
        triggerType: "lead_idle_in_status",
        triggerConfig: {
          targetStatus: "pricingRequest",
          idleValue: 2,
          idleUnit: "days",
        },
      },
    ]);

    mockFindMany.mockImplementation(async () => [
      {
        id: "lead-1",
        teamId: "team-1",
        status: "pricingRequest",
        statusEnteredAt: enteredAt,
      },
    ]);

    const useCase = new EvaluateIdleLeadsUseCase();
    const output = await useCase.evaluate();

    expect(output.isValid).toBe(true);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "lead_idle_in_status",
      teamId: "team-1",
      leadId: "lead-1",
      data: {
        status: "pricingRequest",
        statusEnteredAt: enteredAt.toISOString(),
      },
    });
  });
});
