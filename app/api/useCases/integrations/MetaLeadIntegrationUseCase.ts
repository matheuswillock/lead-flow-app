import { Output } from "@/lib/output";
import { encryptToken } from "@/lib/integrations-crypto";
import { metaLeadIntegrationRepository } from "@/app/api/infra/data/repositories/integrations/MetaLeadIntegrationRepository";
import { RegisterNewUserProfile } from "../profiles/ProfileUseCase";
import { prisma } from "../../infra/data/prisma";

export interface MetaLeadIntegrationCreateDTO {
  pageId: string;
  pageAccessToken: string;
  verifyToken: string;
  teamId?: string | null;
  defaultAssigneeId?: string | null;
  isActive?: boolean;
}

export interface MetaLeadIntegrationUpdateDTO {
  pageId?: string;
  pageAccessToken?: string;
  verifyToken?: string;
  teamId?: string | null;
  defaultAssigneeId?: string | null;
  isActive?: boolean;
}

export class MetaLeadIntegrationUseCase {
  constructor(
    private readonly profileUseCase = new RegisterNewUserProfile(),
    private readonly repo = metaLeadIntegrationRepository
  ) {}

  async listBySupabaseId(supabaseId: string, teamId?: string | null): Promise<Output> {
    const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      return new Output(false, [], ["Perfil não encontrado"], null);
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      return new Output(false, [], ["Manager não identificado"], null);
    }

    const integrations = await this.repo.findByManagerId(managerId);
    const filtered = teamId ? integrations.filter((item) => item.teamId === teamId) : integrations;

    return new Output(true, [], [], filtered.map((item) => this.sanitize(item)));
  }

  async create(supabaseId: string, data: MetaLeadIntegrationCreateDTO): Promise<Output> {
    const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      return new Output(false, [], ["Perfil não encontrado"], null);
    }

    if (profileInfo.role !== "manager") {
      return new Output(false, [], ["Apenas managers podem configurar integrações"], null);
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      return new Output(false, [], ["Manager não identificado"], null);
    }

    if (!data.pageId || !data.pageAccessToken || !data.verifyToken) {
      return new Output(false, [], ["pageId, pageAccessToken e verifyToken são obrigatórios"], null);
    }

    const resolvedTeamId = await this.resolveTeamId(managerId, data.teamId ?? profileInfo.activeTeamId ?? null);
    if (!resolvedTeamId) {
      return new Output(false, [], ["Team inválido para este manager"], null);
    }

    if (data.defaultAssigneeId) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_profileId: {
            teamId: resolvedTeamId,
            profileId: data.defaultAssigneeId
          }
        }
      });

      if (!membership) {
        return new Output(false, [], ["Default assignee não pertence ao time"], null);
      }
    }

    try {
      const integration = await this.repo.create({
        manager: { connect: { id: managerId } },
        team: { connect: { id: resolvedTeamId } },
        pageId: data.pageId,
        pageAccessTokenEnc: encryptToken(data.pageAccessToken),
        verifyToken: data.verifyToken,
        isActive: data.isActive ?? false,
        ...(data.defaultAssigneeId && {
          defaultAssignee: { connect: { id: data.defaultAssigneeId } }
        })
      });

      return new Output(true, ["Integração Meta Lead Ads criada"], [], this.sanitize(integration));
    } catch (error: any) {
      const message = error?.message || "Erro ao criar integração";
      return new Output(false, [], [message], null);
    }
  }

  async update(supabaseId: string, integrationId: string, data: MetaLeadIntegrationUpdateDTO): Promise<Output> {
    const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
    if (!profileInfo) {
      return new Output(false, [], ["Perfil não encontrado"], null);
    }

    if (profileInfo.role !== "manager") {
      return new Output(false, [], ["Apenas managers podem configurar integrações"], null);
    }

    const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
    if (!managerId) {
      return new Output(false, [], ["Manager não identificado"], null);
    }

    const existing = await this.repo.findById(integrationId);
    if (!existing || existing.managerId !== managerId) {
      return new Output(false, [], ["Integração não encontrada"], null);
    }

    const resolvedTeamId = await this.resolveTeamId(managerId, data.teamId ?? existing.teamId ?? profileInfo.activeTeamId ?? null);
    if (!resolvedTeamId) {
      return new Output(false, [], ["Team inválido para este manager"], null);
    }

    if (data.defaultAssigneeId) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_profileId: {
            teamId: resolvedTeamId,
            profileId: data.defaultAssigneeId
          }
        }
      });

      if (!membership) {
        return new Output(false, [], ["Default assignee não pertence ao time"], null);
      }
    }

    try {
      const updated = await this.repo.update(integrationId, {
        pageId: data.pageId ?? undefined,
        verifyToken: data.verifyToken ?? undefined,
        isActive: data.isActive ?? undefined,
        team: { connect: { id: resolvedTeamId } },
        ...(data.pageAccessToken && {
          pageAccessTokenEnc: encryptToken(data.pageAccessToken)
        }),
        ...(data.defaultAssigneeId !== undefined && {
          defaultAssignee: data.defaultAssigneeId
            ? { connect: { id: data.defaultAssigneeId } }
            : { disconnect: true }
        })
      });

      return new Output(true, ["Integração Meta Lead Ads atualizada"], [], this.sanitize(updated));
    } catch (error: any) {
      const message = error?.message || "Erro ao atualizar integração";
      return new Output(false, [], [message], null);
    }
  }

  private sanitize(integration: any) {
    return {
      id: integration.id,
      managerId: integration.managerId,
      teamId: integration.teamId,
      pageId: integration.pageId,
      verifyToken: integration.verifyToken,
      isActive: integration.isActive,
      defaultAssigneeId: integration.defaultAssigneeId,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  private async resolveTeamId(managerId: string, teamId: string | null): Promise<string | null> {
    if (!teamId) return null;
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        masterId: managerId
      },
      select: { id: true }
    });
    return team?.id ?? null;
  }
}

export const metaLeadIntegrationUseCase = new MetaLeadIntegrationUseCase();
