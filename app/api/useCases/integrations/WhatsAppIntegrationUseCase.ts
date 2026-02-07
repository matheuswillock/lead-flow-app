import { Output } from "@/lib/output";
import { encryptToken } from "@/lib/integrations-crypto";
import { whatsAppIntegrationRepository } from "@/app/api/infra/data/repositories/integrations/WhatsAppIntegrationRepository";
import { RegisterNewUserProfile } from "../profiles/ProfileUseCase";
import { prisma } from "../../infra/data/prisma";

export interface WhatsAppIntegrationCreateDTO {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  businessAccountId?: string | null;
  businessPhoneNumber?: string | null;
  teamId?: string | null;
  isActive?: boolean;
}

export interface WhatsAppIntegrationUpdateDTO {
  phoneNumberId?: string;
  accessToken?: string;
  verifyToken?: string;
  businessAccountId?: string | null;
  businessPhoneNumber?: string | null;
  teamId?: string | null;
  isActive?: boolean;
}

export class WhatsAppIntegrationUseCase {
  constructor(
    private readonly profileUseCase = new RegisterNewUserProfile(),
    private readonly repo = whatsAppIntegrationRepository
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

  async create(supabaseId: string, data: WhatsAppIntegrationCreateDTO): Promise<Output> {
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

    if (!data.phoneNumberId || !data.accessToken || !data.verifyToken) {
      return new Output(false, [], ["phoneNumberId, accessToken e verifyToken são obrigatórios"], null);
    }

    const resolvedTeamId = await this.resolveTeamId(managerId, data.teamId ?? profileInfo.activeTeamId ?? null);
    if (!resolvedTeamId) {
      return new Output(false, [], ["Team inválido para este manager"], null);
    }

    try {
      const integration = await this.repo.create({
        manager: { connect: { id: managerId } },
        team: { connect: { id: resolvedTeamId } },
        phoneNumberId: data.phoneNumberId,
        accessTokenEnc: encryptToken(data.accessToken),
        verifyToken: data.verifyToken,
        businessAccountId: data.businessAccountId ?? null,
        businessPhoneNumber: data.businessPhoneNumber ?? null,
        isActive: data.isActive ?? false,
      });

      return new Output(true, ["Integração WhatsApp criada"], [], this.sanitize(integration));
    } catch (error: any) {
      const message = error?.message || "Erro ao criar integração";
      return new Output(false, [], [message], null);
    }
  }

  async update(supabaseId: string, integrationId: string, data: WhatsAppIntegrationUpdateDTO): Promise<Output> {
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

    try {
      const updated = await this.repo.update(integrationId, {
        phoneNumberId: data.phoneNumberId ?? undefined,
        verifyToken: data.verifyToken ?? undefined,
        businessAccountId: data.businessAccountId ?? undefined,
        businessPhoneNumber: data.businessPhoneNumber ?? undefined,
        isActive: data.isActive ?? undefined,
        team: { connect: { id: resolvedTeamId } },
        ...(data.accessToken && {
          accessTokenEnc: encryptToken(data.accessToken)
        })
      });

      return new Output(true, ["Integração WhatsApp atualizada"], [], this.sanitize(updated));
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
      phoneNumberId: integration.phoneNumberId,
      businessAccountId: integration.businessAccountId,
      businessPhoneNumber: integration.businessPhoneNumber,
      verifyToken: integration.verifyToken,
      isActive: integration.isActive,
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

export const whatsAppIntegrationUseCase = new WhatsAppIntegrationUseCase();
