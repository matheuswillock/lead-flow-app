import type { PendingOperator } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreatePendingOperatorInput,
  IPendingOperatorRepository,
  PendingOperatorWithManager,
} from "./IPendingOperatorRepository"

const managerSelect = {
  id: true,
  email: true,
  fullName: true,
  supabaseId: true,
  asaasSubscriptionId: true,
  asaasCustomerId: true,
  timezone: true,
} as const

export class PendingOperatorRepository implements IPendingOperatorRepository {
  async create(data: CreatePendingOperatorInput): Promise<PendingOperator> {
    return prisma.pendingOperator.create({
      data: {
        managerId: data.managerId,
        teamId: data.teamId ?? null,
        name: data.name,
        email: data.email,
        role: data.role,
        functions: data.functions,
        paymentId: data.paymentId,
        subscriptionId: data.subscriptionId ?? null,
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod,
      },
    })
  }

  async findByPaymentIdWithManager(paymentId: string): Promise<PendingOperatorWithManager | null> {
    // select (não include) com a relação aninhada — mesmo resultado, sem
    // trazer o Profile inteiro do manager (só os campos que o caller usa).
    return prisma.pendingOperator.findFirst({
      where: { paymentId },
      select: {
        id: true,
        managerId: true,
        teamId: true,
        name: true,
        email: true,
        role: true,
        functions: true,
        paymentId: true,
        subscriptionId: true,
        paymentStatus: true,
        paymentMethod: true,
        operatorCreated: true,
        operatorId: true,
        createdAt: true,
        updatedAt: true,
        manager: { select: managerSelect },
      },
    })
  }

  async updatePaymentId(id: string, paymentId: string): Promise<void> {
    await prisma.pendingOperator.update({
      where: { id },
      data: { paymentId },
    })
  }

  async deleteById(id: string): Promise<void> {
    await prisma.pendingOperator.delete({ where: { id } })
  }
}

export const pendingOperatorRepository = new PendingOperatorRepository()
