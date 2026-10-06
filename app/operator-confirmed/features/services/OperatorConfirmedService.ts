import { API_CLIENT_BASE } from "@/lib/route-map";
import type { PendingOperatorData } from "../context/OperatorConfirmedTypes";
import type { IOperatorConfirmedService } from "./IOperatorConfirmedService";

export class OperatorConfirmedService implements IOperatorConfirmedService {
  async fetchOperatorData(pendingOperatorId: string): Promise<PendingOperatorData> {
    const response = await fetch(`${API_CLIENT_BASE}/operators/pending/${pendingOperatorId}`);
    const result = await response.json();

    if (!response.ok || !result.isValid || !result.result) {
      throw new Error(result.errorMessages?.join(", ") || "Erro ao buscar informações do operador");
    }

    return result.result as PendingOperatorData;
  }
}

export const operatorConfirmedService = new OperatorConfirmedService();
