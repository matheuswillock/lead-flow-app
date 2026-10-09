import { beforeEach, describe, expect, it, jest } from "bun:test";
import { SubscriptionUpgradeRepository } from "./SubscriptionUpgradeRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import type { AsaasAccountId } from "@/lib/asaas";
import type { UserRole, UserFunction } from "@prisma/client";

const jestMock = jest as typeof jest & { mock: (moduleName: string, factory: () => unknown) => void };
// Mock do Prisma para testes unitários
jestMock.mock("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    team: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    teamMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    pendingOperator: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    profileSubscription: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(prisma)),
  },
}));

type MockFunction = ReturnType<typeof jest.fn>;
type PrismaMock = Record<string, Record<string, MockFunction>>;

describe("SubscriptionUpgradeRepository", () => {
  let repository: SubscriptionUpgradeRepository;
  let mockPrisma: PrismaMock;

  beforeEach(() => {
    repository = new SubscriptionUpgradeRepository();
    mockPrisma = prisma as unknown as PrismaMock;
    jest.clearAllMocks();
  });

  const mockManagerProfile = {
    id: "manager-1",
    supabaseId: "supabase-1",
    email: "manager@test.com",
    fullName: "Manager Test",
    role: "manager" as UserRole,
    isMaster: true,
    asaasCustomerId: "cus_123",
    asaasCustomerAccount: "primary" as AsaasAccountId,
    asaasSubscriptionId: "sub_123",
    subscriptionStatus: "active",
    asaasSubscriptionAccount: "primary" as AsaasAccountId,
    subscriptionNextDueDate: new Date("2026-12-01"),
    subscriptionCycle: "MONTHLY",
    operatorCount: 2,
    timezone: "America/Sao_Paulo",
    cpfCnpj: "12345678901",
    phone: "11999999999",
    postalCode: "01234567",
    address: "Rua Teste",
    addressNumber: "123",
    complement: "Apto 45",
  };

  const mockOperatorProfile = {
    id: "operator-1",
    supabaseId: "supabase-op-1",
    fullName: "Operator Test",
    email: "operator@test.com",
    role: "operator" as UserRole,
    functions: ["SDR"] as UserFunction[],
    managerId: "manager-1",
    asaasSubscriptionId: "sub_123",
  };

  describe("findManagerProfileById", () => {
    it("deve retornar perfil do manager quando encontrado", async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(mockManagerProfile);

      const result = await repository.findManagerProfileById("manager-1");

      expect(result).toEqual({
        ...mockManagerProfile,
        asaasCustomerAccount: "primary",
        asaasSubscriptionAccount: "primary",
      });
      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: "manager-1" },
        select: expect.any(Object),
      });
    });

    it("deve retornar null quando manager não encontrado", async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await repository.findManagerProfileById("inexistente");

      expect(result).toBeNull();
    });

    it("usa a quantidade real de operadores ao montar o perfil de cobrança", async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        ...mockManagerProfile,
        operatorCount: 1,
        _count: { operators: 3 },
      });

      const result = await repository.findManagerProfileById("manager-1");

      expect(result?.operatorCount).toBe(3);
    });
  });

  describe("findManagerProfileBySupabaseId", () => {
    it("deve retornar perfil do manager por supabaseId", async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(mockManagerProfile);

      const result = await repository.findManagerProfileBySupabaseId("supabase-1");

      expect(result).toEqual({
        ...mockManagerProfile,
        asaasCustomerAccount: "primary",
        asaasSubscriptionAccount: "primary",
      });
      expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
        where: { supabaseId: "supabase-1" },
        select: expect.any(Object),
      });
    });
  });


  describe("updateManagerCustomerId", () => {
    it("deve atualizar customer ID e conta do manager", async () => {
      mockPrisma.profile.update.mockResolvedValue({});

      await repository.updateManagerCustomerId("manager-1", "cus_new", "primary");

      expect(mockPrisma.profile.update).toHaveBeenCalledWith({
        where: { id: "manager-1" },
        data: {
          asaasCustomerId: "cus_new",
          asaasCustomerAccount: "primary",
        },
      });
    });
  });



  describe("findProfileByEmail", () => {
    it("deve retornar contato do perfil por email", async () => {
      mockPrisma.profile.findFirst.mockResolvedValue({
        id: "profile-1",
        email: "test@test.com",
        fullName: "Test User",
      });

      const result = await repository.findProfileByEmail("test@test.com");

      expect(result).toEqual({
        id: "profile-1",
        email: "test@test.com",
        fullName: "Test User",
      });
    });
  });

  describe("findDefaultTeamByMasterId", () => {
    it("deve retornar time padrão do master", async () => {
      mockPrisma.team.findFirst.mockResolvedValue({
        id: "team-1",
        masterId: "manager-1",
        isDefault: true,
        deletedAt: null,
        master: { sponsorMasterId: null },
      });

      const result = await repository.findDefaultTeamByMasterId("manager-1");

      expect(result).toEqual({
        id: "team-1",
        masterId: "manager-1",
        isDefault: true,
        deletedAt: null,
        master: { sponsorMasterId: null },
      });
    });
  });

  describe("countActiveTeamsByMasterId", () => {
    it("deve contar times ativos do master", async () => {
      mockPrisma.team.count.mockResolvedValue(3);

      const result = await repository.countActiveTeamsByMasterId("manager-1");

      expect(result).toBe(3);
      expect(mockPrisma.team.count).toHaveBeenCalledWith({
        where: { masterId: "manager-1", deletedAt: null },
      });
    });
  });



  describe("PendingOperator operations", () => {
    const mockPendingOperator = {
      id: "pending-1",
      managerId: "manager-1",
      teamId: null,
      name: "New Operator",
      email: "new@test.com",
      role: "operator",
      functions: ["SDR"] as UserFunction[],
      paymentId: "pay_123",
      subscriptionId: null,
      paymentStatus: "PENDING",
      paymentMethod: "PIX",
      asaasAccount: "primary" as AsaasAccountId,
      operatorCreated: false,
      operatorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      manager: mockManagerProfile,
    };

    describe("createPendingOperator", () => {
      it("deve criar pending operator", async () => {
        mockPrisma.pendingOperator.create.mockResolvedValue(mockPendingOperator);

        const result = await repository.createPendingOperator({
          managerId: "manager-1",
          teamId: null,
          name: "New Operator",
          email: "new@test.com",
          role: "operator",
          functions: ["SDR"],
          paymentId: "pay_123",
          subscriptionId: null,
          paymentStatus: "PENDING",
          paymentMethod: "PIX",
          asaasAccount: "primary",
        });

        expect(result).toEqual(mockPendingOperator as unknown as typeof result);
      });
    });

    describe("findActivePendingOperatorByManagerAndEmail", () => {
      it("deve retornar pending operator ativo por manager e email", async () => {
        mockPrisma.pendingOperator.findFirst.mockResolvedValue({
          id: "pending-1",
          createdAt: new Date(),
        });

        const result = await repository.findActivePendingOperatorByManagerAndEmail(
          "manager-1",
          "new@test.com"
        );

        expect(result).toEqual({
          id: "pending-1",
          createdAt: expect.any(Date),
        });
      });
    });

    describe("findPendingOperatorByPaymentIdWithManager", () => {
      it("deve retornar pending operator com manager por paymentId e conta", async () => {
        mockPrisma.pendingOperator.findFirst.mockResolvedValue(mockPendingOperator);

        const result = await repository.findPendingOperatorByPaymentIdWithManager(
          "pay_123",
          "primary"
        );

        expect(result).toEqual({
          ...mockPendingOperator,
          manager: {
            ...mockManagerProfile,
            asaasCustomerAccount: "primary",
            asaasSubscriptionAccount: "primary",
          },
        });
      });
    });

    describe("updatePendingOperatorPaymentId", () => {
      it("deve atualizar paymentId e conta do pending operator", async () => {
        mockPrisma.pendingOperator.update.mockResolvedValue({});

        await repository.updatePendingOperatorPaymentId("pending-1", "pay_new", "legacy");

        expect(mockPrisma.pendingOperator.update).toHaveBeenCalledWith({
          where: { id: "pending-1" },
          data: { paymentId: "pay_new", asaasAccount: "legacy" },
        });
      });
    });

    describe("updatePendingOperatorPaymentStatus", () => {
      it("deve atualizar somente o status retornado pelo Asaas", async () => {
        mockPrisma.pendingOperator.update.mockResolvedValue({});

        await repository.updatePendingOperatorPaymentStatus("pending-1", "CONFIRMED");

        expect(mockPrisma.pendingOperator.update).toHaveBeenCalledWith({
          where: { id: "pending-1" },
          data: { paymentStatus: "CONFIRMED" },
        });
      });
    });

    describe("provisionConfirmedOperator", () => {
      it("cria operador, membership, confirmação e contador na mesma transação", async () => {
        mockPrisma.$transaction.mockImplementation(async (fn: (transaction: typeof prisma) => Promise<unknown>) => fn(prisma));
        mockPrisma.profile.create.mockResolvedValue(mockOperatorProfile);
        mockPrisma.teamMember.create.mockResolvedValue({ id: "member-1" });
        mockPrisma.pendingOperator.update.mockResolvedValue({});
        mockPrisma.profile.update.mockResolvedValue({});

        const result = await repository.provisionConfirmedOperator({
          pendingOperatorId: "pending-1",
          managerId: "manager-1",
          teamId: "team-1",
          operator: {
            supabaseId: "supabase-op-1",
            fullName: "Operator Test",
            email: "operator@test.com",
            role: "operator",
            functions: ["SDR"],
            managerId: "manager-1",
          },
        });

        expect(result).toEqual(mockOperatorProfile);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.profile.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ managerId: "manager-1" }),
          select: expect.any(Object),
        }));
        expect(mockPrisma.teamMember.create).toHaveBeenCalledWith({
          data: { teamId: "team-1", profileId: "operator-1", role: "operator", functions: ["SDR"] },
        });
        expect(mockPrisma.pendingOperator.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: "pending-1" },
          data: expect.objectContaining({ operatorCreated: true, operatorId: "operator-1", paymentStatus: "CONFIRMED" }),
        }));
        expect(mockPrisma.profile.update).toHaveBeenCalledWith({
          where: { id: "manager-1" },
          data: { operatorCount: { increment: 1 } },
        });
      });
    });


    describe("markPendingOperatorSubscriptionUpdated", () => {
      it("deve marcar subscription como atualizada no pending operator", async () => {
        mockPrisma.pendingOperator.update.mockResolvedValue({});

        await repository.markPendingOperatorSubscriptionUpdated("pending-1");

        expect(mockPrisma.pendingOperator.update).toHaveBeenCalledWith({
          where: { id: "pending-1" },
          data: { updatedAt: expect.any(Date) },
        });
      });
    });

    describe("deletePendingOperatorById", () => {
      it("deve deletar pending operator", async () => {
        mockPrisma.pendingOperator.delete.mockResolvedValue({});

        await repository.deletePendingOperatorById("pending-1");

        expect(mockPrisma.pendingOperator.delete).toHaveBeenCalledWith({
          where: { id: "pending-1" },
        });
      });
    });
  });

  describe("ProfileSubscription operations", () => {
    const mockProfileSubscription = {
      hasPermanentSubscription: false,
      asaasSubscriptionId: "sub_123",
      asaasSubscriptionAccount: "primary",
      product: {
        id: "prod-1",
        name: "Plano Base",
        priceMonthly: 59.9,
        isActive: true,
      },
      capacity: {
        includedExtraUsers: 0,
        includedExtraTeams: 0,
        manualAdjustmentExtraUsers: 0,
        manualAdjustmentExtraTeams: 0,
      },
    };

    describe("findProfileSubscriptionByProfileId", () => {
      it("deve retornar profile subscription", async () => {
        mockPrisma.profileSubscription.findUnique.mockResolvedValue(
          mockProfileSubscription
        );

        const result = await repository.findProfileSubscriptionByProfileId(
          "manager-1"
        );

        expect(result).toEqual({
          ...mockProfileSubscription,
          asaasSubscriptionAccount: "primary",
        });
      });

      it("deve retornar null quando não existe", async () => {
        mockPrisma.profileSubscription.findUnique.mockResolvedValue(null);

        const result = await repository.findProfileSubscriptionByProfileId(
          "inexistente"
        );

        expect(result).toBeNull();
      });
    });

    describe("findProfileSubscriptionById", () => {
      it("deve chamar findProfileSubscriptionByProfileId", async () => {
        mockPrisma.profileSubscription.findUnique.mockResolvedValue(
          mockProfileSubscription
        );

        const result = await repository.findProfileSubscriptionById("manager-1");

        expect(result).toEqual({
          ...mockProfileSubscription,
          asaasSubscriptionAccount: "primary",
        });
      });
    });
  });
});
