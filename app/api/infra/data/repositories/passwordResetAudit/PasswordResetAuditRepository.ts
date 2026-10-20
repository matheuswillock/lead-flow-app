import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreatePasswordResetFlowInput,
  IPasswordResetAuditRepository,
  RecordPasswordResetEventInput,
  UpdatePasswordResetFlowInput,
} from "./IPasswordResetAuditRepository"

export class PasswordResetAuditRepository implements IPasswordResetAuditRepository {
  async createFlow(input: CreatePasswordResetFlowInput): Promise<{ id: string }> {
    const flowId = randomUUID()

    await prisma.$transaction(async (transaction) => {
      await transaction.passwordResetFlow.create({
        data: {
          id: flowId,
          profileId: input.profileId,
          recipientEmail: input.recipientEmail.trim().toLowerCase(),
          status: input.status,
          ipHash: input.ipHash,
          userAgent: input.userAgent,
          originScreen: input.originScreen,
        } as unknown as Prisma.PasswordResetFlowUncheckedCreateInput,
      })

      await transaction.passwordResetEvent.create({
        data: {
          id: randomUUID(),
          flowId,
          type: input.event.type,
          requestId: input.event.requestId ?? null,
          failureCode: input.event.failureCode ?? null,
          ipHash: input.event.ipHash ?? null,
          userAgent: input.event.userAgent ?? null,
          occurredAt: input.event.occurredAt,
        } as unknown as Prisma.PasswordResetEventUncheckedCreateInput,
      })
    })

    return { id: flowId }
  }

  async recordEvent(input: RecordPasswordResetEventInput): Promise<void> {
    await prisma.passwordResetEvent.create({
      data: {
        id: randomUUID(),
        flowId: input.flowId,
        type: input.type,
        requestId: input.requestId ?? null,
        failureCode: input.failureCode ?? null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        occurredAt: input.occurredAt,
      } as unknown as Prisma.PasswordResetEventUncheckedCreateInput,
    })
  }

  async updateFlow(input: UpdatePasswordResetFlowInput): Promise<void> {
    const { flowId, ...data } = input
    await prisma.passwordResetFlow.update({
      where: { id: flowId },
      data: data as unknown as Prisma.PasswordResetFlowUncheckedUpdateInput,
    })
  }

  async findFlowByResendEmailId(resendEmailId: string) {
    return prisma.passwordResetFlow.findFirst({
      where: { resendEmailId },
      select: { id: true, status: true },
    })
  }

  async findFlow(flowId: string) {
    return prisma.passwordResetFlow.findFirst({
      where: { id: flowId },
      select: { id: true, status: true },
    }) as Promise<{
      id: string
      status: import("./IPasswordResetAuditRepository").PasswordResetFlowStatusValue
    } | null>
  }

  async findFlowById(flowId: string) {
    return prisma.passwordResetFlow.findUnique({
      where: { id: flowId },
      select: { id: true, status: true },
    }) as Promise<{
      id: string
      status: import("./IPasswordResetAuditRepository").PasswordResetFlowStatusValue
    } | null>
  }
}

export const passwordResetAuditRepository = new PasswordResetAuditRepository()
