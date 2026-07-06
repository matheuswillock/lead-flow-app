import { sanitizeDocumentDigits } from "@/lib/masks";
import type {
  ICnpjLookupService,
  ResolveLeadRazaoSocialInput,
  ResolveLeadRazaoSocialResult,
} from "./ICnpjLookupService";

const BRASIL_API_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1";
const LOOKUP_TIMEOUT_MS = 5000;
const LOOKUP_MAX_ATTEMPTS = 3;
const LOOKUP_RETRY_DELAY_MS = 400;

type BrasilApiCnpjResponse = {
  razao_social?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CnpjLookupService implements ICnpjLookupService {
  async lookupRazaoSocial(cnpj: string): Promise<string | null> {
    const digits = sanitizeDocumentDigits(cnpj);
    if (digits.length !== 14) {
      return null;
    }

    for (let attempt = 1; attempt <= LOOKUP_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

      try {
        console.info(
          `[CnpjLookupService][lookupRazaoSocial] Consultando CNPJ (tentativa ${attempt}/${LOOKUP_MAX_ATTEMPTS})`,
          digits
        );
        const response = await fetch(`${BRASIL_API_CNPJ_URL}/${digits}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          // 404 significa CNPJ inexistente na Receita: nao adianta tentar de novo.
          if (response.status === 404) {
            console.error(
              "[CnpjLookupService][lookupRazaoSocial] CNPJ nao encontrado",
              response.status,
              digits
            );
            return null;
          }

          console.error(
            "[CnpjLookupService][lookupRazaoSocial] Falha na consulta",
            response.status,
            digits
          );
          if (attempt < LOOKUP_MAX_ATTEMPTS) {
            await sleep(LOOKUP_RETRY_DELAY_MS * attempt);
            continue;
          }
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
        console.error(
          `[CnpjLookupService][lookupRazaoSocial] Erro na consulta (tentativa ${attempt}/${LOOKUP_MAX_ATTEMPTS})`,
          error
        );
        if (attempt < LOOKUP_MAX_ATTEMPTS) {
          await sleep(LOOKUP_RETRY_DELAY_MS * attempt);
          continue;
        }
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return null;
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
