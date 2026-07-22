import { cacheLife, cacheTag } from "next/cache";
import { Output } from "@/lib/output";
import { cacheTags } from "@/lib/cache/cacheTags";
import { invalidateDialerCampaignCache } from "@/lib/cache/invalidation";
import { DialerRepository } from "@/app/api/infra/data/repositories/dialer/DialerRepository";
import type {
  DialerCampaignDetail,
  DialerCampaignListItem,
  DialerTeamContext,
  IDialerRepository,
} from "@/app/api/infra/data/repositories/dialer/IDialerRepository";
import type {
  CreateDialerCampaignInput,
  IDialerCampaignUseCase,
  UpdateDialerCampaignInput,
} from "./IDialerCampaignUseCase";

export const DIALER_CAMPAIGN_ERROR_MESSAGES = {
  CAMPAIGN_NOT_FOUND: "Campanha não encontrada",
  INVALID_NAME: "Nome da campanha é obrigatório",
  CAMPAIGN_LOCKED: "Campanha em discagem não pode ser editada ou excluída",
  INTERNAL_ERROR: "Erro interno no módulo da discadora",
} as const;

export type DialerCampaignDto = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalContacts: number;
  contactsProcessed: number;
  contactsAnswered: number;
  minutesUsed: number;
  answerRate: number;
  managerName: string | null;
  createdAt: string;
  updatedAt: string;
};

function toCampaignDto(campaign: DialerCampaignListItem | DialerCampaignDetail): DialerCampaignDto {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    totalContacts: campaign.totalContacts,
    contactsProcessed: campaign.contactsProcessed,
    contactsAnswered: campaign.contactsAnswered,
    minutesUsed: Number(campaign.minutesUsed),
    answerRate:
      campaign.contactsProcessed > 0
        ? Math.round((campaign.contactsAnswered / campaign.contactsProcessed) * 100)
        : 0,
    managerName: campaign.manager.fullName || campaign.manager.email,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

async function listCachedDialerCampaigns(teamId: string): Promise<DialerCampaignDto[]> {
  "use cache";
  cacheTag(cacheTags.dialerCampaigns(teamId));
  cacheLife({ stale: 30, revalidate: 120, expire: 600 });

  const repository = new DialerRepository();
  const campaigns = await repository.findCampaignsWithCtx({ teamId, profileId: "" });
  return campaigns.map(toCampaignDto);
}

async function getCachedDialerCampaign(
  teamId: string,
  campaignId: string
): Promise<DialerCampaignDto | null> {
  "use cache";
  cacheTag(cacheTags.dialerCampaign(campaignId));
  cacheLife({ stale: 30, revalidate: 120, expire: 600 });

  const repository = new DialerRepository();
  const campaign = await repository.findCampaignByIdWithCtx({ teamId, profileId: "" }, campaignId);
  return campaign ? toCampaignDto(campaign) : null;
}

export class DialerCampaignUseCase implements IDialerCampaignUseCase {
  constructor(private readonly repository: IDialerRepository) {}

  async listCampaigns(ctx: DialerTeamContext): Promise<Output> {
    try {
      const campaigns = await listCachedDialerCampaigns(ctx.teamId);
      return new Output(true, ["Campanhas listadas com sucesso"], [], { campaigns });
    } catch (error) {
      console.error("[DialerCampaignUseCase][listCampaigns]", error);
      return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }

  async getCampaign(ctx: DialerTeamContext, campaignId: string): Promise<Output> {
    try {
      const campaign = await getCachedDialerCampaign(ctx.teamId, campaignId);
      if (!campaign) {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND], null);
      }
      return new Output(true, ["Campanha encontrada"], [], { campaign });
    } catch (error) {
      console.error("[DialerCampaignUseCase][getCampaign]", error);
      return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }

  async createCampaign(ctx: DialerTeamContext, input: CreateDialerCampaignInput): Promise<Output> {
    try {
      const name = input.name?.trim();
      if (!name) {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INVALID_NAME], null);
      }

      const campaign = await this.repository.createCampaignWithCtx(ctx, {
        name,
        description: input.description?.trim() || null,
      });

      invalidateDialerCampaignCache({ teamId: ctx.teamId, campaignId: campaign.id });
      return new Output(true, ["Campanha criada com sucesso"], [], {
        campaign: toCampaignDto(campaign),
      });
    } catch (error) {
      console.error("[DialerCampaignUseCase][createCampaign]", error);
      return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }

  async updateCampaign(
    ctx: DialerTeamContext,
    campaignId: string,
    input: UpdateDialerCampaignInput
  ): Promise<Output> {
    try {
      const existing = await this.repository.findCampaignByIdWithCtx(ctx, campaignId);
      if (!existing) {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND], null);
      }
      if (existing.status === "running") {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_LOCKED], null);
      }

      const name = input.name?.trim();
      if (input.name !== undefined && !name) {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INVALID_NAME], null);
      }

      const campaign = await this.repository.updateCampaignWithCtx(ctx, campaignId, {
        ...(name !== undefined ? { name } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
      });

      invalidateDialerCampaignCache({ teamId: ctx.teamId, campaignId });
      return new Output(true, ["Campanha atualizada com sucesso"], [], {
        campaign: toCampaignDto(campaign),
      });
    } catch (error) {
      console.error("[DialerCampaignUseCase][updateCampaign]", error);
      return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }

  async deleteCampaign(ctx: DialerTeamContext, campaignId: string): Promise<Output> {
    try {
      const existing = await this.repository.findCampaignByIdWithCtx(ctx, campaignId);
      if (!existing) {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND], null);
      }
      if (existing.status === "running") {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_LOCKED], null);
      }

      await this.repository.deleteCampaignWithCtx(ctx, campaignId);
      invalidateDialerCampaignCache({ teamId: ctx.teamId, campaignId });
      return new Output(true, ["Campanha excluída com sucesso"], [], null);
    } catch (error) {
      console.error("[DialerCampaignUseCase][deleteCampaign]", error);
      return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }

  async listContacts(
    ctx: DialerTeamContext,
    campaignId: string,
    pagination: { page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const campaign = await this.repository.findCampaignByIdWithCtx(ctx, campaignId);
      if (!campaign) {
        return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.CAMPAIGN_NOT_FOUND], null);
      }

      const { contacts, total } = await this.repository.findContactsWithCtx(
        ctx,
        campaignId,
        pagination
      );

      return new Output(true, ["Contatos listados com sucesso"], [], {
        contacts,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
    } catch (error) {
      console.error("[DialerCampaignUseCase][listContacts]", error);
      return new Output(false, [], [DIALER_CAMPAIGN_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }
}

export const dialerCampaignUseCase = new DialerCampaignUseCase(new DialerRepository());
