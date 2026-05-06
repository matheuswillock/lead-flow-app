import { PendingAction } from "@prisma/client";

export interface IPendingActionRepository {
  findById(id: string): Promise<(PendingAction & { master: any }) | null>;
  findByIdSimple(id: string): Promise<PendingAction | null>;
  updatePaymentId(id: string, paymentId: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
}
