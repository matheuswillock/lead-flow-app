import { randomUUID } from "crypto";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  CreateDialerCampaignData,
  CreateDialerContactData,
  DialerCampaignDetail,
  DialerCampaignListItem,
  DialerContactListItem,
  DialerTeamContext,
  IDialerRepository,
  TeamDialerConfig,
  TeamTwilioToken,
  UpdateDialerCampaignData,
} from "./IDialerRepository";

const CAMPAIGN_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  totalContacts: true,
  contactsProcessed: true,
  contactsAnswered: true,
  minutesUsed: true,
  createdAt: true,
  updatedAt: true,
  manager: {
    select: { id: true, fullName: true, email: true },
  },
} as const;

const CAMPAIGN_DETAIL_SELECT = {
  ...CAMPAIGN_LIST_SELECT,
  teamId: true,
} as const;

export class DialerRepository implements IDialerRepository {
  async findTeamDialerConfig(teamId: string): Promise<TeamDialerConfig | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: {
        dialerEnabled: true,
        twilioSubaccountSid: true,
        twilioApiKeySid: true,
        twilioApiKeySecret: true,
        twilioAppSid: true,
      },
    })
  }

  async findTeamTwilioToken(teamId: string): Promise<TeamTwilioToken | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { twilioSubaccountToken: true },
    })
  }

  async findCampaignsWithCtx(ctx: DialerTeamContext): Promise<DialerCampaignListItem[]> {
    return prisma.dialerCampaign.findMany({
      where: { teamId: ctx.teamId },
      select: CAMPAIGN_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async findCampaignByIdWithCtx(
    ctx: DialerTeamContext,
    campaignId: string
  ): Promise<DialerCampaignDetail | null> {
    return prisma.dialerCampaign.findFirst({
      where: { id: campaignId, teamId: ctx.teamId },
      select: CAMPAIGN_DETAIL_SELECT,
    });
  }

  async createCampaignWithCtx(
    ctx: DialerTeamContext,
    data: CreateDialerCampaignData
  ): Promise<DialerCampaignDetail> {
    return prisma.dialerCampaign.create({
      data: {
        id: randomUUID(),
        teamId: ctx.teamId,
        managerId: ctx.profileId,
        name: data.name,
        description: data.description ?? null,
      },
      select: CAMPAIGN_DETAIL_SELECT,
    });
  }

  async updateCampaignWithCtx(
    ctx: DialerTeamContext,
    campaignId: string,
    data: UpdateDialerCampaignData
  ): Promise<DialerCampaignDetail> {
    return prisma.dialerCampaign.update({
      where: { id: campaignId, teamId: ctx.teamId },
      data,
      select: CAMPAIGN_DETAIL_SELECT,
    });
  }

  async deleteCampaignWithCtx(ctx: DialerTeamContext, campaignId: string): Promise<void> {
    await prisma.dialerCampaign.delete({
      where: { id: campaignId, teamId: ctx.teamId },
      select: { id: true },
    });
  }

  async findContactsWithCtx(
    ctx: DialerTeamContext,
    campaignId: string,
    pagination: { page: number; pageSize: number }
  ): Promise<{ contacts: DialerContactListItem[]; total: number }> {
    const where = { campaignId, campaign: { teamId: ctx.teamId } };
    const [contacts, total] = await Promise.all([
      prisma.dialerContact.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          processed: true,
          position: true,
        },
        orderBy: { position: "asc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      prisma.dialerContact.count({ where }),
    ]);

    return { contacts, total };
  }

  async appendContactsWithCtx(
    ctx: DialerTeamContext,
    campaignId: string,
    contacts: CreateDialerContactData[]
  ): Promise<{ inserted: number; totalContacts: number }> {
    return prisma.$transaction(async (tx) => {
      // Lock pessimista na campanha: serializa uploads concorrentes (evita
      // janela de corrida no dedupe de telefones e colisão de positions)
      await tx.$queryRaw`
        select "id" from "public"."corretor_studio_dialer_campaigns"
        where "id" = ${campaignId}::uuid for update
      `;

      const campaign = await tx.dialerCampaign.findFirst({
        where: { id: campaignId, teamId: ctx.teamId },
        select: { status: true },
      });

      const lastContact = await tx.dialerContact.findFirst({
        where: { campaignId },
        select: { position: true },
        orderBy: { position: "desc" },
      });
      const basePosition = (lastContact?.position ?? 0) + 1;

      const created = await tx.dialerContact.createMany({
        data: contacts.map((contact, index) => ({
          id: randomUUID(),
          campaignId,
          name: contact.name,
          phone: contact.phone,
          email: contact.email ?? null,
          metadata: contact.metadata,
          position: basePosition + index,
        })),
        // Backstop da unique (campaignId, phone) para corridas com o pré-filtro
        skipDuplicates: true,
      });

      const totalContacts = await tx.dialerContact.count({ where: { campaignId } });

      await tx.dialerCampaign.update({
        where: { id: campaignId, teamId: ctx.teamId },
        data: {
          totalContacts,
          ...(campaign?.status === "draft" ? { status: "ready" as const } : {}),
        },
        select: { id: true },
      });

      return { inserted: created.count, totalContacts };
    });
  }

  async findContactPhonesWithCtx(ctx: DialerTeamContext, campaignId: string): Promise<string[]> {
    const contacts = await prisma.dialerContact.findMany({
      where: { campaignId, campaign: { teamId: ctx.teamId } },
      select: { phone: true },
    });
    return contacts.map((contact) => contact.phone);
  }

  async countContactsWithCtx(ctx: DialerTeamContext, campaignId: string): Promise<number> {
    return prisma.dialerContact.count({
      where: { campaignId, campaign: { teamId: ctx.teamId } },
    });
  }
}
