import { sanitizeDocumentDigits } from "@/lib/masks";
import type { ICnpjLookupService } from "./ICnpjLookupService";

const BRASIL_API_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1";
const RECEITAWS_CNPJ_URL = "https://receitaws.com.br/v1/cnpj";
const LOOKUP_TIMEOUT_MS = 5000;
const LOOKUP_MAX_ATTEMPTS = 3;
const LOOKUP_RETRY_DELAY_MS = 400;

type BrasilApiCnpjResponse = {
  razao_social?: string;
};

type ReceitaWsCnpjResponse = {
  status?: string; // "OK" | "ERROR"
  nome?: string;
  message?: string;
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

    const viaBrasilApi = await this.lookupViaBrasilApi(digits);
    if (viaBrasilApi) {
      return viaBrasilApi;
    }

    return this.lookupViaReceitaWs(digits);
  }

  private async lookupViaBrasilApi(digits: string): Promise<string | null> {
    for (let attempt = 1; attempt <= LOOKUP_MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

      try {
        console.info(
          `[CnpjLookupService][lookupViaBrasilApi] Consultando CNPJ (tentativa ${attempt}/${LOOKUP_MAX_ATTEMPTS})`,
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
              "[CnpjLookupService][lookupViaBrasilApi] CNPJ nao encontrado",
              response.status,
              digits
            );
            return null;
          }

          console.error(
            "[CnpjLookupService][lookupViaBrasilApi] Falha na consulta",
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
          console.error("[CnpjLookupService][lookupViaBrasilApi] Resposta sem razao_social", digits);
          return null;
        }

        console.info("[CnpjLookupService][lookupViaBrasilApi] Razão social encontrada", digits);
        return razaoSocial;
      } catch (error) {
        console.error(
          `[CnpjLookupService][lookupViaBrasilApi] Erro na consulta (tentativa ${attempt}/${LOOKUP_MAX_ATTEMPTS})`,
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

  private async lookupViaReceitaWs(digits: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    try {
      console.info("[CnpjLookupService][lookupViaReceitaWs] Consultando CNPJ (fallback)", digits);
      const response = await fetch(`${RECEITAWS_CNPJ_URL}/${digits}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      let payload: ReceitaWsCnpjResponse | null = null;
      try {
        payload = (await response.json()) as ReceitaWsCnpjResponse;
      } catch {
        // Rate limit da ReceitaWS (>3 req/min) retorna texto puro, nao JSON.
        console.error(
          "[CnpjLookupService][lookupViaReceitaWs] Resposta nao-JSON (provavel rate limit)",
          digits
        );
        return null;
      }

      if (!response.ok || payload.status === "ERROR" || !payload.nome) {
        console.error(
          "[CnpjLookupService][lookupViaReceitaWs] Falha na consulta",
          response.status,
          payload.message,
          digits
        );
        return null;
      }

      const razaoSocial = payload.nome.trim();
      if (!razaoSocial) {
        return null;
      }

      console.info("[CnpjLookupService][lookupViaReceitaWs] Razão social encontrada (fallback)", digits);
      return razaoSocial;
    } catch (error) {
      console.error("[CnpjLookupService][lookupViaReceitaWs] Erro na consulta", error);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const cnpjLookupService = new CnpjLookupService();
