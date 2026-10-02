import type { PendingOperatorData } from "../context/OperatorConfirmedTypes";

export interface IOperatorConfirmedService {
  fetchOperatorData(pendingOperatorId: string): Promise<PendingOperatorData>;
}
