import type { DialerCampaignStatus, Prisma } from "@prisma/client";

export type DialerTeamContext = {
  teamId: string;
  profileId: string;
};

export type DialerCampaignListItem = {
  id: string;
  name: string;
  description: string | null;
  status: DialerCampaignStatus;
  totalContacts: number;
  contactsProcessed: number;
  contactsAnswered: number;
  minutesUsed: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  manager: { id: string; fullName: string | null; email: string | null };
};

export type DialerCampaignDetail = DialerCampaignListItem & {
  teamId: string;
};

export type DialerContactListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  processed: boolean;
  position: number;
};

export type CreateDialerCampaignData = {
  name: string;
  description?: string | null;
};

export type UpdateDialerCampaignData = {
  name?: string;
  description?: string | null;
  status?: DialerCampaignStatus;
};

export type CreateDialerContactData = {
  name: string;
  phone: string;
  email?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export type TeamDialerConfig = {
  dialerEnabled: boolean
  twilioSubaccountSid: string | null
  twilioApiKeySid: string | null
  twilioApiKeySecret: string | null
  twilioAppSid: string | null
}

export type TeamTwilioToken = {
  twilioSubaccountToken: string | null
}

export interface IDialerRepository {
  findTeamDialerConfig(teamId: string): Promise<TeamDialerConfig | null>
  findTeamTwilioToken(teamId: string): Promise<TeamTwilioToken | null>
  findCampaignsWithCtx(ctx: DialerTeamContext): Promise<DialerCampaignListItem[]>;
  findCampaignByIdWithCtx(
    ctx: DialerTeamContext,
    campaignId: string
  ): Promise<DialerCampaignDetail | null>;
  createCampaignWithCtx(
    ctx: DialerTeamContext,
    data: CreateDialerCampaignData
  ): Promise<DialerCampaignDetail>;
  updateCampaignWithCtx(
    ctx: DialerTeamContext,
    campaignId: string,
    data: UpdateDialerCampaignData
  ): Promise<DialerCampaignDetail>;
  deleteCampaignWithCtx(ctx: DialerTeamContext, campaignId: string): Promise<void>;
  findContactsWithCtx(
    ctx: DialerTeamContext,
    campaignId: string,
    pagination: { page: number; pageSize: number }
  ): Promise<{ contacts: DialerContactListItem[]; total: number }>;
  appendContactsWithCtx(
    ctx: DialerTeamContext,
    campaignId: string,
    contacts: CreateDialerContactData[]
  ): Promise<{ inserted: number; totalContacts: number }>;
  countContactsWithCtx(ctx: DialerTeamContext, campaignId: string): Promise<number>;
  findContactPhonesWithCtx(ctx: DialerTeamContext, campaignId: string): Promise<string[]>;
}
