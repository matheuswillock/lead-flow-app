import { prisma } from "@/app/api/infra/data/prisma";
import type {
  BillingPendingActionRecord,
  IPendingActionRepository,
} from "./IPendingActionRepository";
import { PendingAction, Prisma } from "@prisma/client";

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
            asaasCustomerId: true,
            asaasSubscriptionId: true,
            subscriptionStatus: true,
            subscriptionNextDueDate: true,
            subscriptionCycle: true,
            hasPermanentSubscription: true,
            timezone: true,
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

  async create(data: {
    masterId: string;
    teamId?: string | null;
    actionType: string;
    status: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const pendingAction = await prisma.pendingAction.create({
      data: {
        masterId: data.masterId,
        teamId: data.teamId ?? null,
        actionType: data.actionType as PendingAction["actionType"],
        status: data.status as PendingAction["status"],
        payload: data.payload as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return pendingAction;
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
      data: { status: status as PendingAction["status"] },
    });
  }

  async updatePayload(id: string, payload: Record<string, unknown>): Promise<void> {
    await prisma.pendingAction.update({
      where: { id },
      data: { payload: payload as Prisma.InputJsonValue },
    });
  }

  async listBillingByMasterId(masterId: string): Promise<BillingPendingActionRecord[]> {
    const rows = await prisma.pendingAction.findMany({
      where: {
        masterId,
        actionType: { in: ["add_user", "add_member", "create_team"] },
        status: { in: ["pending", "applied", "failed"] },
      },
      select: {
        id: true,
        actionType: true,
        status: true,
        paymentId: true,
        createdAt: true,
        payload: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      status: row.status,
      paymentId: row.paymentId,
      createdAt: row.createdAt,
      payload: row.payload,
    }));
  }
}

export const pendingActionRepository = new PendingActionRepository();
