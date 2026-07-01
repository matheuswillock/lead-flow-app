import { Output } from "@/lib/output";
import type {
  BethaniaLinkInitiateResult,
  BethaniaLinkStatus,
  BethaniaRequestContext,
  IBethaniaLinkService,
} from "./IBethaniaLinkService";

class BethaniaLinkService implements IBethaniaLinkService {
  private baseUrl = "/api/v1/bot/link";

  private buildHeaders(context: BethaniaRequestContext): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-supabase-user-id": context.supabaseId,
      "x-team-id": context.teamId,
    };
  }

  private async parseOutput(response: Response): Promise<Output> {
    const data = await response.json();
    return data as Output;
  }

  async getStatus(context: BethaniaRequestContext): Promise<BethaniaLinkStatus> {
    const response = await fetch(`${this.baseUrl}/status`, {
      method: "GET",
      cache: "no-store",
      headers: this.buildHeaders(context),
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.join(", ") || "Erro ao consultar vínculo da Bethânia");
    }

    return output.result as BethaniaLinkStatus;
  }

  async initiate(context: BethaniaRequestContext): Promise<BethaniaLinkInitiateResult> {
    const response = await fetch(`${this.baseUrl}/initiate`, {
      method: "POST",
      headers: this.buildHeaders(context),
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.join(", ") || "Erro ao gerar código de vínculo");
    }

    return output.result as BethaniaLinkInitiateResult;
  }

  async revoke(context: BethaniaRequestContext): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: "DELETE",
      headers: this.buildHeaders(context),
    });

    const output = await this.parseOutput(response);
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.join(", ") || "Erro ao revogar vínculo");
    }
  }

  buildLinkCommand(code: string): string {
    return `VINCULAR ${code}`;
  }

  buildWhatsappDeepLink(code: string): string | null {
    const phone = process.env.NEXT_PUBLIC_BETHANIA_WHATSAPP_NUMBER?.replace(/\D/g, "");
    if (!phone) {
      return null;
    }

    const text = encodeURIComponent(this.buildLinkCommand(code));
    return `https://wa.me/${phone}?text=${text}`;
  }
}

export const bethaniaLinkService = new BethaniaLinkService();
