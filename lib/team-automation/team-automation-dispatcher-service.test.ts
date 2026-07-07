import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { TeamAutomationEvent } from "@/lib/team-automation/types";

const mockFindEnabled = mock(async () => [] as unknown[]);
const mockFindLead = mock(async () => null as unknown);
const mockTryCreateRunLog = mock(async (): Promise<{ id: string } | null> => ({ id: "log-1" }));
const mockCountMessaging = mock(async () => 0);
const mockUpdateRunLog = mock(async () => ({}));

mock.module("@/app/api/infra/data/repositories/teamAutomation/TeamAutomationRuleRepository", () => ({
  teamAutomationRuleRepository: {
    findEnabledByTeamAndTrigger: mockFindEnabled,
    tryCreateRunLog: mockTryCreateRunLog,
    countMessagingActionsToday: mockCountMessaging,
    updateRunLog: mockUpdateRunLog,
  },
}));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    lead: {
      findFirst: mockFindLead,
    },
  },
}));

const mockExecute = mock(async () => ({ status: "success" as const }));

mock.module("@/app/api/services/teamAutomation/executors/SendWhatsAppMessageExecutor", () => ({
  SendWhatsAppMessageExecutor: class {
    actionType = "send_whatsapp_message";
    execute = mockExecute;
  },
}));

mock.module("@/app/api/services/teamAutomation/executors/SendEmailExecutor", () => ({
  SendEmailExecutor: class {
    actionType = "send_email";
    execute = mockExecute;
  },
}));

mock.module("@/app/api/services/teamAutomation/executors/CreateNotificationExecutor", () => ({
  CreateNotificationExecutor: class {
    actionType = "create_notification";
    execute = mockExecute;
  },
}));

mock.module("@/app/api/services/teamAutomation/executors/AssignOperatorExecutor", () => ({
  AssignOperatorExecutor: class {
    actionType = "assign_operator";
    execute = mockExecute;
  },
}));

const { TeamAutomationDispatcherService } = await import(
  "@/app/api/services/teamAutomation/TeamAutomationDispatcherService"
);

const baseEvent: TeamAutomationEvent = {
  type: "lead_created",
  teamId: "team-1",
  leadId: "lead-1",
};

const baseRule = {
  id: "rule-1",
  teamId: "team-1",
  createdBy: "profile-1",
  name: "Regra teste",
  description: null,
  triggerType: "lead_created" as const,
  triggerConfig: {},
  actionType: "create_notification" as const,
  actionConfig: { messageTemplate: "Olá {{lead.name}}" },
  isEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseLead = {
  id: "lead-1",
  teamId: "team-1",
  name: "Lead Teste",
  status: "new_opportunity" as const,
  leadCode: "L123",
  email: "lead@test.com",
  phone: "5511999999999",
  assignedTo: null,
};

describe("TeamAutomationDispatcherService", () => {
  beforeEach(() => {
    mockFindEnabled.mockReset();
    mockFindLead.mockReset();
    mockTryCreateRunLog.mockReset();
    mockCountMessaging.mockReset();
    mockUpdateRunLog.mockReset();
    mockExecute.mockReset();

    mockFindEnabled.mockImplementation(async () => []);
    mockFindLead.mockImplementation(async () => null);
    mockTryCreateRunLog.mockImplementation(async () => ({ id: "log-1" }));
    mockCountMessaging.mockImplementation(async () => 0);
    mockUpdateRunLog.mockImplementation(async () => ({}));
    mockExecute.mockImplementation(async () => ({ status: "success" }));
  });

  it("não executa quando não há regras habilitadas", async () => {
    const service = new TeamAutomationDispatcherService();
    await service.dispatch(baseEvent);
    expect(mockTryCreateRunLog).not.toHaveBeenCalled();
  });

  it("pula execução quando dedupeKey já existe", async () => {
    mockFindEnabled.mockImplementation(async () => [baseRule]);
    mockFindLead.mockImplementation(async () => baseLead);
    mockTryCreateRunLog.mockImplementation(async () => null);

    const service = new TeamAutomationDispatcherService();
    await service.dispatch(baseEvent);

    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("marca failed quando executor lança erro", async () => {
    mockFindEnabled.mockImplementation(async () => [baseRule]);
    mockFindLead.mockImplementation(async () => baseLead);
    mockExecute.mockImplementation(async () => {
      throw new Error("falha simulada");
    });

    const service = new TeamAutomationDispatcherService();
    await expect(service.dispatch(baseEvent)).resolves.toBeUndefined();

    expect(mockUpdateRunLog).toHaveBeenCalled();
    const updateArgs = mockUpdateRunLog.mock.calls.at(0) as unknown as
      | [string, { status?: string; errorMessage?: string | null }]
      | undefined;
    expect(updateArgs?.[1]).toMatchObject({ status: "failed" });
  });
});
