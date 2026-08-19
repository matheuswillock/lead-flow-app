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

export class AdquirirCreditosService implements IAdquirirCreditosService {
  async validarCredito(input: {
    email: string;
    plan: CreditPlan;
  }): Promise<AdquirirCreditosResult> {
    const response = await fetch(`${API_CLIENT_BASE}/adquirir/creditos/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await response
      .json()
      .catch(() => null)) as OutputResponse<AdquirirCreditosResult> | null;

    if (response.status === 404) {
      throw new Error(
        data?.errorMessages?.[0] ??
          "E-mail não encontrado. Use o e-mail da sua conta no Corretor Studio.",
      );
    }

    if (!response.ok || !data?.isValid || !data?.result?.checkoutUrl) {
      throw new Error(
        data?.errorMessages?.[0] ?? "Não foi possível validar o e-mail. Tente novamente.",
      );
    }

    return data.result;
  }
}