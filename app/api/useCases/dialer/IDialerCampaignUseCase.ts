import type { Output } from "@/lib/output";
import type { DialerTeamContext } from "@/app/api/infra/data/repositories/dialer/IDialerRepository";

export type CreateDialerCampaignInput = {
  name: string;
  description?: string | null;
};

export type UpdateDialerCampaignInput = {
  name?: string;
  description?: string | null;
};

export interface IDialerCampaignUseCase {
  listCampaigns(ctx: DialerTeamContext): Promise<Output>;
  getCampaign(ctx: DialerTeamContext, campaignId: string): Promise<Output>;
  createCampaign(ctx: DialerTeamContext, input: CreateDialerCampaignInput): Promise<Output>;
  updateCampaign(
    ctx: DialerTeamContext,
    campaignId: string,
    input: UpdateDialerCampaignInput
  ): Promise<Output>;
  deleteCampaign(ctx: DialerTeamContext, campaignId: string): Promise<Output>;
  listContacts(
    ctx: DialerTeamContext,
    campaignId: string,
    pagination: { page: number; pageSize: number }
  ): Promise<Output>;
}
