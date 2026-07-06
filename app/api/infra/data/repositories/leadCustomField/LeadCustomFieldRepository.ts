import { prisma } from "@/app/api/infra/data/prisma";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type { Prisma } from "@prisma/client";
import {
  type ILeadCustomFieldRepository,
  type LeadCustomFieldDefinitionCreateInput,
  type LeadCustomFieldDefinitionRecord,
  type LeadCustomFieldDefinitionUpdateInput,
} from "./ILeadCustomFieldRepository";

const definitionSelect = {
  id: true,
  teamId: true,
  key: true,
  label: true,
  type: true,
  options: true,
  isRequired: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadCustomFieldDefinitionSelect;

export class LeadCustomFieldRepository implements ILeadCustomFieldRepository {
  async listByTeamWithCtx(access: TeamAccess, includeInactive = false): Promise<LeadCustomFieldDefinitionRecord[]> {
    return prisma.leadCustomFieldDefinition.findMany({
      where: {
        teamId: access.teamId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: definitionSelect,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async findByIdWithCtx(access: TeamAccess, definitionId: string): Promise<LeadCustomFieldDefinitionRecord | null> {
    return prisma.leadCustomFieldDefinition.findFirst({
      where: { id: definitionId, teamId: access.teamId },
      select: definitionSelect,
    });
  }

  async countActiveByTeamWithCtx(access: TeamAccess): Promise<number> {
    return prisma.leadCustomFieldDefinition.count({
      where: { teamId: access.teamId, isActive: true },
    });
  }

  async createWithCtx(
    access: TeamAccess,
    input: LeadCustomFieldDefinitionCreateInput
  ): Promise<LeadCustomFieldDefinitionRecord> {
    return prisma.leadCustomFieldDefinition.create({
      data: {
        teamId: access.teamId,
        createdBy: access.profileId,
        key: input.key,
        label: input.label,
        type: input.type,
        options: input.options ?? undefined,
        isRequired: input.isRequired ?? false,
        displayOrder: input.displayOrder ?? 0,
      },
      select: definitionSelect,
    });
  }

  async updateWithCtx(
    access: TeamAccess,
    definitionId: string,
    input: LeadCustomFieldDefinitionUpdateInput
  ): Promise<LeadCustomFieldDefinitionRecord | null> {
    const existing = await this.findByIdWithCtx(access, definitionId);
    if (!existing) return null;

    return prisma.leadCustomFieldDefinition.update({
      where: { id: definitionId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.options !== undefined ? { options: input.options ?? undefined } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: definitionSelect,
    });
  }

  async countValuesByDefinitionId(definitionId: string): Promise<number> {
    return prisma.leadCustomFieldValue.count({ where: { definitionId } });
  }

  async deleteDefinition(definitionId: string): Promise<void> {
    await prisma.leadCustomFieldDefinition.delete({ where: { id: definitionId } });
  }

  async listActiveByTeamId(teamId: string): Promise<LeadCustomFieldDefinitionRecord[]> {
    return prisma.leadCustomFieldDefinition.findMany({
      where: { teamId, isActive: true },
      select: definitionSelect,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async listValuesByLeadId(leadId: string) {
    return prisma.leadCustomFieldValue.findMany({
      where: { leadId },
      select: {
        definitionId: true,
        value: true,
        definition: { select: definitionSelect },
      },
    });
  }

  async upsertValuesForLead(
    leadId: string,
    entries: Array<{ definitionId: string; value: Prisma.InputJsonValue }>
  ): Promise<void> {
    if (entries.length === 0) return;

    await prisma.$transaction(
      entries.map((entry) =>
        prisma.leadCustomFieldValue.upsert({
          where: {
            leadId_definitionId: {
              leadId,
              definitionId: entry.definitionId,
            },
          },
          create: {
            leadId,
            definitionId: entry.definitionId,
            value: entry.value,
          },
          update: {
            value: entry.value,
          },
        })
      )
    );
  }
}

export const leadCustomFieldRepository = new LeadCustomFieldRepository();
