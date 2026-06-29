import { sanitizeDocumentDigits } from "@/lib/masks";
import type {
  ICnpjLookupService,
  ResolveLeadRazaoSocialInput,
  ResolveLeadRazaoSocialResult,
} from "./ICnpjLookupService";

const BRASIL_API_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1";
const LOOKUP_TIMEOUT_MS = 5000;

type BrasilApiCnpjResponse = {
  razao_social?: string;
};

export class CnpjLookupService implements ICnpjLookupService {
  async lookupRazaoSocial(cnpj: string): Promise<string | null> {
    const digits = sanitizeDocumentDigits(cnpj);
    if (digits.length !== 14) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      console.info("[CnpjLookupService][lookupRazaoSocial] Consultando CNPJ", digits);
      const response = await fetch(`${BRASIL_API_CNPJ_URL}/${digits}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(
          "[CnpjLookupService][lookupRazaoSocial] Falha na consulta",
          response.status,
          digits
        );
        return null;
      }

      const payload = (await response.json()) as BrasilApiCnpjResponse;
      const razaoSocial = payload.razao_social?.trim() ?? "";
      if (!razaoSocial) {
        console.error("[CnpjLookupService][lookupRazaoSocial] Resposta sem razao_social", digits);
        return null;
      }

      console.info("[CnpjLookupService][lookupRazaoSocial] Razão social encontrada", digits);
      return razaoSocial;
    } catch (error) {
      console.error("[CnpjLookupService][lookupRazaoSocial] Erro na consulta", error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export async function resolveLeadRazaoSocial(
  input: ResolveLeadRazaoSocialInput,
  lookupService: ICnpjLookupService = new CnpjLookupService()
): Promise<ResolveLeadRazaoSocialResult> {
  const nextCnpj = input.cnpj?.trim() ?? "";
  if (!nextCnpj) {
    return { razaoSocial: null, lookupAttempted: false, lookupSucceeded: false };
  }

  const previousCnpj = input.previousCnpj?.trim() ?? "";
  const previousRazaoSocial = input.previousRazaoSocial?.trim() ?? "";

  if (nextCnpj === previousCnpj && previousRazaoSocial) {
    return {
      razaoSocial: previousRazaoSocial,
      lookupAttempted: false,
      lookupSucceeded: true,
    };
  }

  const razaoSocial = await lookupService.lookupRazaoSocial(nextCnpj);
  return {
    razaoSocial,
    lookupAttempted: true,
    lookupSucceeded: !!razaoSocial,
  };
}

export const cnpjLookupService = new CnpjLookupService();
