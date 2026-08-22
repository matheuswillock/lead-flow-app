import { Output } from "@/lib/output";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { leadTransferRepository } from "@/app/api/infra/data/repositories/leadTransfer/LeadTransferRepository";
import type {
  ILeadRepository,
  LeadAuthorizationSnapshot,
} from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type { ILeadTransferRepository } from "@/app/api/infra/data/repositories/leadTransfer/ILeadTransferRepository";

export const LEAD_NOT_FOUND_MESSAGE = "Lead não encontrado ou sem permissão no seu time.";

/** Reexportado para que as rotas nao precisem importar do repositorio. */
export type { LeadAuthorizationSnapshot };

export type AuthorizeLeadAccessInput = {
  leadId: string;
  teamId: string;
  profileId: string;
  /** Managers e masters do time de origem ainda enxergam um lead transferido. */
  allowTransferredFromTeam: boolean;
};

/**
 * Decide se um lead pode ser acessado pelo time da requisicao.
 *
 * A checagem de identidade/permissao da conta (perfil, membership, ban e
 * assinatura) e responsabilidade do `getTeamAccess` na rota. Aqui fica apenas
 * a regra de posse do lead: ele pertence ao time, ou saiu dele por uma
 * transferencia que o solicitante ainda tem direito de ver.
 */
export class AuthorizeLeadAccessUseCase {
  constructor(
    private readonly leads: ILeadRepository,
    private readonly transfers: ILeadTransferRepository
  ) {}

  async execute(input: AuthorizeLeadAccessInput): Promise<Output> {
    const lead = await this.leads.findAuthorizationSnapshotById(input.leadId);

    if (!lead) {
      return new Output(false, [], [LEAD_NOT_FOUND_MESSAGE], null);
    }

    if (lead.teamId === input.teamId) {
      return new Output(true, [], [], lead satisfies LeadAuthorizationSnapshot);
    }

    if (!input.allowTransferredFromTeam) {
      return this.denyWithTeamMismatchLog(input, lead.teamId);
    }

    const wasTransferredFromRequesterTeam = await this.transfers.existsTransferFromTeam({
      leadId: input.leadId,
      fromTeamId: input.teamId,
    });

    if (!wasTransferredFromRequesterTeam) {
      return this.denyWithTeamMismatchLog(input, lead.teamId);
    }

    return new Output(true, [], [], lead satisfies LeadAuthorizationSnapshot);
  }

  private denyWithTeamMismatchLog(
    input: AuthorizeLeadAccessInput,
    leadTeamId: string | null
  ): Output {
    console.warn("[AuthorizeLeadAccessUseCase] time do lead diverge do time da requisicao", {
      requestedLeadId: input.leadId,
      requestTeamId: input.teamId,
      leadTeamId,
      profileId: input.profileId,
    });
    return new Output(false, [], [LEAD_NOT_FOUND_MESSAGE], null);
  }
}

export const authorizeLeadAccessUseCase = new AuthorizeLeadAccessUseCase(
  leadRepository,
  leadTransferRepository
);
