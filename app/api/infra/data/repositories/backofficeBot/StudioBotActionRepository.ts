import { ActivityType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { escapeLikePattern } from "@/lib/prisma/escape-like-pattern";
import { isManagerLikeRole } from "@/lib/roles";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { buildStudioBotActivityPayload } from "@/lib/studio-bot/activity-payload";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";

class StudioBotActionRepository {
  async findLeadPolicyContext(leadId: string, teamId: string) {
    return prisma.lead.findFirst({
      where: { id: leadId, teamId },
      select: { assignedTo: true, closerId: true },
    });
  }

  async listLeads(access: TeamAccess, search?: string, limit = 10) {
    const isManager = access.isMaster || isManagerLikeRole(access.teamMember.role);
    const result = isManager
      ? await leadRepository.findAllByTeamId(access.teamId, { search })
      : await leadRepository.findAllByOperatorIdInTeam(access.profileId, access.teamId, {
          search,
        });

    return result.leads.slice(0, limit).map((lead) => ({
      id: lead.id,
      leadCode: lead.leadCode,
      name: lead.name,
      status: lead.status,
      phone: lead.phone,
      email: lead.email,
    }));
  }

  async findLeadDetail(leadId: string, teamId: string) {
    return prisma.lead.findFirst({
      where: { id: leadId, teamId },
      select: {
        id: true,
        leadCode: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        notes: true,
        meetingDate: true,
        meetingTitle: true,
        assignedTo: true,
        closerId: true,
        assignee: { select: { fullName: true } },
        closer: { select: { fullName: true } },
      },
    });
  }

  async findLeadIdByCode(access: TeamAccess, leadCode: string): Promise<string | null> {
    const code = leadCode.trim();
    if (!code) return null;

    const isManager = access.isMaster || isManagerLikeRole(access.teamMember.role);
    const scopedWhere = isManager
      ? { teamId: access.teamId }
      : {
          teamId: access.teamId,
          OR: [
            { assignedTo: access.profileId },
            { createdBy: access.profileId },
            { closerId: access.profileId },
          ],
        };

    // `escapeLikePattern`: sem ele o `mode: "insensitive"` vira ILIKE com o
    // valor cru, então `LD_0001` casa `LD-0001` e `LD-%` casa qualquer código.
    // O retorno vai direto para o bot agir sobre o lead, sem reconferência.
    const lead = await prisma.lead.findFirst({
      where: {
        ...scopedWhere,
        leadCode: { equals: escapeLikePattern(code), mode: "insensitive" },
      },
      select: { id: true },
    });

    return lead?.id ?? null;
  }

  async findAgendaToday(access: TeamAccess) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const isManager = access.isMaster || isManagerLikeRole(access.teamMember.role);

    const whereClause = isManager
      ? {
          lead: { teamId: access.teamId },
          date: { gte: startOfDay, lte: endOfDay },
        }
      : {
          lead: {
            teamId: access.teamId,
            OR: [
              { assignedTo: access.profileId },
              { createdBy: access.profileId },
              { closerId: access.profileId },
            ],
          },
          date: { gte: startOfDay, lte: endOfDay },
        };

    return prisma.leadsSchedule.findMany({
      where: whereClause,
      select: {
        id: true,
        leadId: true,
        date: true,
        meetingTitle: true,
        meetingLink: true,
        lead: { select: { leadCode: true, name: true } },
      },
      orderBy: { date: "asc" },
      take: 20,
    });
  }

  async getTeamDigestCounts(teamId: string) {
    const [leadCount, scheduleCount] = await Promise.all([
      prisma.lead.count({ where: { teamId } }),
      prisma.leadsSchedule.count({
        where: { lead: { teamId }, date: { gte: new Date() } },
      }),
    ]);
    return { leadCount, scheduleCount };
  }

  async createNoteActivity(
    leadId: string,
    body: string,
    profileId: string,
    userLinkId: string,
    flowId?: string | null
  ) {
    return prisma.leadActivity.create({
      data: {
        leadId,
        ...buildStudioActivityData({
          type: ActivityType.note,
          body,
          payload: buildStudioBotActivityPayload(userLinkId, "add_note", flowId),
        }),
      },
      select: { id: true, body: true, createdAt: true },
    });
  }

  async createStudioBotActivity(
    leadId: string,
    body: string,
    profileId: string,
    userLinkId: string,
    action: string,
    flowId?: string | null,
    extraPayload?: Record<string, unknown>
  ) {
    return prisma.leadActivity.create({
      data: {
        leadId,
        ...buildStudioActivityData({
          type: ActivityType.studio_bot,
          body,
          payload: {
            ...buildStudioBotActivityPayload(userLinkId, action, flowId),
            ...extraPayload,
          },
        }),
      },
    });
  }

  async createAttachmentRecord(input: {
    leadId: string;
    fileName: string;
    fileUrl: string;
    storagePath: string;
    fileType: string;
    fileSize: number;
    uploadedBy: string;
  }) {
    return prisma.leadAttachment.create({
      data: input,
      select: { id: true, fileName: true, fileUrl: true },
    });
  }

  async findLeadForSchedule(leadId: string, teamId: string) {
    return prisma.lead.findFirst({
      where: { id: leadId, teamId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        managerId: true,
        assignedTo: true,
        closerId: true,
        leadCode: true,
        assignee: { select: { email: true } },
      },
    });
  }

  async findLeadInTeam(leadId: string, teamId: string) {
    return prisma.lead.findFirst({
      where: { id: leadId, teamId },
      select: { id: true },
    });
  }

  async cancelLatestSchedule(leadId: string) {
    const schedule = await leadScheduleRepository.findLatestByLeadId(leadId);
    if (!schedule) {
      return null;
    }
    await leadScheduleRepository.delete(schedule.id);
    return schedule;
  }
}

export const studioBotActionRepository = new StudioBotActionRepository();
