import { PendingAction } from "@prisma/client";

export type BillingPendingActionRecord = {
  id: string;
  actionType: string;
  status: string;
  paymentId: string | null;
  createdAt: Date;
  payload: unknown;
};

export interface IPendingActionRepository {
  findById(id: string): Promise<(PendingAction & { master: any }) | null>;
  findByIdSimple(id: string): Promise<PendingAction | null>;
  create(data: {
    masterId: string;
    teamId?: string | null;
    actionType: string;
    status: string;
    payload: Record<string, unknown>;
  }): Promise<{ id: string }>;
  updatePaymentId(id: string, paymentId: string): Promise<void>;
  clearPaymentId(id: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
  updatePayload(id: string, payload: Record<string, unknown>): Promise<void>;
  listBillingByMasterId(masterId: string): Promise<BillingPendingActionRecord[]>;
}
