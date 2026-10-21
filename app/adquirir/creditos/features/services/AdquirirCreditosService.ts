import { API_CLIENT_BASE } from "@/lib/route-map";
import type {
  AdquirirCreditosResult,
  CreditPlan,
} from "../context/AdquirirCreditosTypes";
import type { IAdquirirCreditosService } from "./IAdquirirCreditosService";

interface OutputResponse<T> {
  isValid: boolean;
  successMessages?: string[];
  errorMessages?: string[];
  result?: T;
}

const GENERIC_ERROR = "Não foi possível iniciar o pagamento. Tente novamente.";

export class AdquirirCreditosService implements IAdquirirCreditosService {
  async iniciarCompra(input: { plan: CreditPlan }): Promise<AdquirirCreditosResult> {
    const response = await fetch(`${API_CLIENT_BASE}/adquirir/creditos/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await response
      .json()
      .catch(() => null)) as OutputResponse<AdquirirCreditosResult> | null;

    if (!response.ok || !data?.isValid || !data?.result?.checkoutUrl) {
      throw new Error(data?.errorMessages?.[0] ?? GENERIC_ERROR);
    }

    return data.result;
  }
}
