import { Prisma, type PendingOperator } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasAccountId } from "@/lib/asaas"
import type {
  CreatePendingOperatorInput,
  IPendingOperatorRepository,
  PendingOperatorWithManager,
} from "./IPendingOperatorRepository"

// Sinalizado pelo índice único parcial (managerId, lower(email)) WHERE
// operatorCreated = false — achado Codex (PR #1137, P1, round 9): fecha
// atomicamente a janela de duas requisições concorrentes de checkout para
// o mesmo e-mail que o preflight sozinho (round 8) não fechava.
export const DUPLICATE_ACTIVE_CHECKOUT_ERROR = "DUPLICATE_ACTIVE_CHECKOUT"

const managerSelect = {
  id: true,
  email: true,
  fullName: true,
  supabaseId: true,
  asaasSubscriptionId: true,
  asaasSubscriptionAccount: true,
  asaasCustomerId: true,
  asaasCustomerAccount: true,
  timezone: true,
} as const

export class PendingOperatorRepository implements IPendingOperatorRepository {
  async create(data: CreatePendingOperatorInput): Promise<PendingOperator> {
    try {
      return await prisma.pendingOperator.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error(DUPLICATE_ACTIVE_CHECKOUT_ERROR, { cause: error })
      }
      throw error
    }
  }

  async findActiveByManagerAndEmail(
    managerId: string,
    email: string
  ): Promise<{ id: string; createdAt: Date } | null> {
    return prisma.pendingOperator.findFirst({
      where: { managerId, email, operatorCreated: false },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
  }

  async findByPaymentIdWithManager(
    paymentId: string,
    account: AsaasAccountId
  ): Promise<PendingOperatorWithManager | null> {
    // select (não include) com a relação aninhada — mesmo resultado, sem
    // trazer o Profile inteiro do manager (só os campos que o caller usa).
    return prisma.pendingOperator.findFirst({
      where: { paymentId, asaasAccount: account },
      select: {
        id: true,
        managerId: true,
        teamId: true,
        name: true,
        email: true,
        role: true,
        functions: true,
        paymentId: true,
        asaasAccount: true,
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

  async updatePaymentId(id: string, paymentId: string, account: AsaasAccountId): Promise<void> {
    await prisma.pendingOperator.update({
      where: { id },
      data: { paymentId, asaasAccount: account },
    })
  }

  async markSubscriptionUpdated(id: string): Promise<void> {
    await prisma.pendingOperator.update({
      where: { id },
      data: { paymentStatus: "SUBSCRIPTION_UPDATED" },
    })
  }

  async deleteById(id: string): Promise<void> {
    await prisma.pendingOperator.delete({ where: { id } })
  }
}

export const pendingOperatorRepository = new PendingOperatorRepository()
