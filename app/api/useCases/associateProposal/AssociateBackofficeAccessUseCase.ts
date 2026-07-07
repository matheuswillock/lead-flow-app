import type { NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { backofficeOperationalAccessService } from "@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService";
import { associateProposalRepository } from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";
import type {
  AssociateBackofficeAccess,
  AssociateBackofficeAccessResult,
} from "./AssociateBackofficeAccessTypes";

export class AssociateBackofficeAccessUseCase {
  async resolve(request: NextRequest): Promise<AssociateBackofficeAccessResult> {
    const teamResult = await getTeamAccess(request);
    if (teamResult.error) {
      return { error: teamResult.error, status: teamResult.status };
    }

    const access = teamResult.access;

    try {
      await backofficeOperationalAccessService.assertAssociadosQueueAccess(access.profileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acesso restrito à fila Associados";
      return {
        error: new Output(false, [], [message], null),
        status: 403,
      };
    }

    const profile = await associateProposalRepository.findProfileSponsorMasterId(access.profileId);
    if (profile?.sponsorMasterId) {
      return {
        error: new Output(false, [], ["Contas associadas não acessam a fila do patrocinador"], null),
        status: 403,
      };
    }

    return {
      access: {
        ...access,
        sponsorProfileId: access.profileId,
      } satisfies AssociateBackofficeAccess,
    };
  }
}

export const associateBackofficeAccessUseCase = new AssociateBackofficeAccessUseCase();
