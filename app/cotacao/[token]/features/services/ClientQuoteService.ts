import { PlanQuoteUseCase } from "@/app/api/useCases/planSimulator/PlanQuoteUseCase";
import { shareSnapshotSchema } from "@/lib/planSimulator/quote";
import type { ClientQuoteResult, ClientQuoteSnapshot } from "../context/ClientQuoteTypes";
import type { IClientQuoteService } from "./IClientQuoteService";

const TOKEN_FORMAT = /^[\w-]{20,64}$/;

/** Leitura pública do snapshot. Roda no servidor; o token é o único segredo. */
class ClientQuoteService implements IClientQuoteService {
  constructor(private readonly quotes = new PlanQuoteUseCase()) {}

  async getByToken(token: string): Promise<ClientQuoteResult> {
    if (!TOKEN_FORMAT.test(token)) {
      return { status: "invalid", message: "Este link não existe ou foi removido." };
    }
    const output = await this.quotes.publicShare(token);
    if (!output.isValid) {
      const expired = output.errorMessages.some((m) => m.includes("expirou"));
      return expired
        ? { status: "expired", message: "Este link expirou. Peça ao seu corretor um novo link." }
        : { status: "invalid", message: "Este link não existe ou foi removido." };
    }
    const parsed = shareSnapshotSchema.safeParse(output.result);
    if (!parsed.success) {
      return { status: "invalid", message: "Não foi possível abrir esta cotação. Peça ao seu corretor um novo link." };
    }
    return { status: "ok", snapshot: parsed.data as ClientQuoteSnapshot };
  }
}

export const clientQuoteService: IClientQuoteService = new ClientQuoteService();
