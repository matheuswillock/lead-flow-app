import { prisma } from "../../prisma";
import type { LeadStatus, ActivityType } from "@prisma/client";

export type LeadListFilter = {
  teamId: string;
  status?: LeadStatus;
  search?: string;
  assignedTo?: string;
  limit: number;
  offset: number;
};

export type CreateLeadData = {
  teamId: string;
  managerId: string;
  leadCode: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  cnpj?: string | null;
  age?: string | null;
  currentHealthPlan?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  closerId?: string | null;
};

export type UpdateLeadData = {
  name?: string;
  email?: string;
  phone?: string;
  age?: string;
  currentHealthPlan?: string;
  notes?: string;
  followUpNotes?: string;
  followUpAt?: Date;
  assignedTo?: string;
  closerId?: string;
};

export class CrmMcpRepository {
  async listLeads(filter: LeadListFilter) {
    const where: Record<string, unknown> = { teamId: filter.teamId };
    if (filter.status) where.status = filter.status;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { email: { contains: filter.search, mode: "insensitive" } },
        { phone: { contains: filter.search, mode: "insensitive" } },
        { leadCode: { contains: filter.search, mode: "insensitive" } },
      ];
    }
    if (filter.assignedTo) where.assignedTo = filter.assignedTo;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit,
        skip: filter.offset,
        select: {
          id: true, leadCode: true, name: true, email: true, phone: true,
          status: true, assignedTo: true, closerId: true,
          meetingDate: true, createdAt: true, updatedAt: true,
          assignee: { select: { id: true, fullName: true } },
          closer: { select: { id: true, fullName: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads, total };
  }

  async findLead(teamId: string, id?: string, leadCode?: string) {
    return prisma.lead.findFirst({
      where: { teamId, ...(id ? { id } : { leadCode }) },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        closer: { select: { id: true, fullName: true, email: true } },
        manager: { select: { id: true, fullName: true, email: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, type: true, body: true, createdAt: true },
        },
      },
    });
  }

  async getTeamMasterId(teamId: string): Promise<string | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { masterId: true },
    });
    return team?.masterId ?? null;
  }

  async countLeads(teamId: string): Promise<number> {
    return prisma.lead.count({ where: { teamId } });
  }

  async createLead(data: CreateLeadData) {
    return prisma.lead.create({
      data,
      select: { id: true, leadCode: true, name: true, status: true, createdAt: true },
    });
  }

  async leadBelongsToTeam(id: string, teamId: string): Promise<boolean> {
    const lead = await prisma.lead.findFirst({ where: { id, teamId }, select: { id: true } });
    return !!lead;
  }

  async updateLead(id: string, data: UpdateLeadData) {
    return prisma.lead.update({
      where: { id },
      data,
      select: { id: true, leadCode: true, name: true, status: true, updatedAt: true },
    });
  }

  async updateLeadStatus(id: string, status: LeadStatus) {
    return prisma.lead.update({
      where: { id },
      data: { status, statusEnteredAt: new Date() },
      select: { id: true, leadCode: true, status: true, statusEnteredAt: true },
    });
  }

  async findLeadForActivity(id: string, teamId: string) {
    return prisma.lead.findFirst({
      where: { id, teamId },
      select: { id: true, managerId: true },
    });
  }

  async listActivities(leadId: string, limit: number) {
    return prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, type: true, body: true, createdAt: true,
        author: { select: { id: true, fullName: true } },
      },
    });
  }

  async createActivity(leadId: string, type: ActivityType, body: string, createdBy: string) {
    return prisma.leadActivity.create({
      data: { leadId, type, body, createdBy },
      select: { id: true, type: true, body: true, createdAt: true },
    });
  }

  async listTeamMembers(teamId: string) {
    return prisma.teamMember.findMany({
      where: { teamId },
      select: {
        role: true,
        functions: true,
        profile: { select: { id: true, fullName: true, email: true } },
      },
    });
  }
}
