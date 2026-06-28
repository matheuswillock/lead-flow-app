import type { NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, hasDelegatedTeamManagementAccess } from "@/app/api/v1/utils/teamAccess";
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import { associateProposalRepository } from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";
import { isManagerLikeRole } from "@/lib/roles";
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
    const { slugs } = await featureAccessService.resolveAllowedSlugs({
      profileId: access.profileId,
      managerId: access.managerId,
      activeTeamId: access.teamId,
    });

    if (!slugs.includes(FEATURE_SLUGS.CRM_BACKOFFICE_ASSOCIADOS)) {
      return {
        error: new Output(false, [], ["Acesso restrito à fila Associados"], null),
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

    const sponsoredCount = await associateProposalRepository.countSponsoredAccounts(access.profileId);
    const isSponsorMaster = sponsoredCount > 0;
    const isBackoffice = access.teamMember.role === "backoffice";
    const isDelegatedManager =
      isManagerLikeRole(access.teamMember.role) && hasDelegatedTeamManagementAccess(access);

    if (!isSponsorMaster && !isBackoffice && !isDelegatedManager && !access.isMaster) {
      return {
        error: new Output(false, [], ["Sem permissão para a fila Associados"], null),
        status: 403,
      };
    }

    const sponsorProfileId = isSponsorMaster ? access.profileId : access.managerId;

    return {
      access: {
        ...access,
        sponsorProfileId,
      } satisfies AssociateBackofficeAccess,
    };
  }
}

export const associateBackofficeAccessUseCase = new AssociateBackofficeAccessUseCase();
