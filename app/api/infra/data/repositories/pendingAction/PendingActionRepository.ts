import { prisma } from "@/app/api/infra/data/prisma";
import type { IPendingActionRepository } from "./IPendingActionRepository";
import { PendingAction } from "@prisma/client";

export class PendingActionRepository implements IPendingActionRepository {
  async findById(id: string) {
    return prisma.pendingAction.findUnique({
      where: { id },
      include: {
        master: {
          select: {
            id: true,
            fullName: true,
            email: true,
            cpfCnpj: true,
            phone: true,
            postalCode: true,
            address: true,
            addressNumber: true,
            neighborhood: true,
            complement: true,
            city: true,
            state: true,
            timezone: true,
            subscription: {
              select: {
                asaasCustomerId: true,
                asaasSubscriptionId: true,
                subscriptionStatus: true,
                subscriptionNextDueDate: true,
                subscriptionCycle: true,
                hasPermanentSubscription: true,
              },
            },
          },
        },
      },
    });
  }

  async findByIdSimple(id: string): Promise<PendingAction | null> {
    return prisma.pendingAction.findUnique({
      where: { id },
    });
  }

  async updatePaymentId(id: string, paymentId: string): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { paymentId },
    });
  }

  async clearPaymentId(id: string): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { paymentId: null },
    });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updatePayload(id: string, payload: Record<string, unknown>): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { payload: payload as any },
    });
  }
}

export const pendingActionRepository = new PendingActionRepository();
