import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { isUniqueConstraintError } from "./WhatsAppAutoResponseRepository"

export type WhatsAppConversationTagSelect = {
  id: string
  teamId: string
  name: string
  color: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export type WhatsAppConversationTagSummary = Pick<
  WhatsAppConversationTagSelect,
  "id" | "name" | "color" | "sortOrder"
>

const TAG_SELECT = {
  id: true,
  teamId: true,
  name: true,
  color: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const

export const WHATSAPP_CONVERSATION_TAG_ASSIGNMENTS_SELECT = {
  tagAssignments: {
    select: {
      tag: {
        select: {
          id: true,
          name: true,
          color: true,
          sortOrder: true,
        },
      },
    },
  },
} as const

export function mapTagAssignmentsToSummaries(
  tagAssignments: Array<{ tag: WhatsAppConversationTagSummary }>
): WhatsAppConversationTagSummary[] {
  return tagAssignments
    .map((assignment) => assignment.tag)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"))
}

export class WhatsAppConversationTagRepository {
  async listByTeamId(teamId: string): Promise<WhatsAppConversationTagSelect[]> {
    return prisma.whatsAppConversationTag.findMany({
      where: { teamId },
      select: TAG_SELECT,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
  }

  async findByIdForTeam(tagId: string, teamId: string): Promise<WhatsAppConversationTagSelect | null> {
    return prisma.whatsAppConversationTag.findFirst({
      where: { id: tagId, teamId },
      select: TAG_SELECT,
    })
  }

  async createTag(data: {
    teamId: string
    name: string
    color: string
    sortOrder?: number
  }): Promise<WhatsAppConversationTagSelect> {
    return prisma.whatsAppConversationTag.create({
      data: {
        team: { connect: { id: data.teamId } },
        name: data.name.trim(),
        color: data.color,
        sortOrder: data.sortOrder ?? 0,
      },
      select: TAG_SELECT,
    })
  }

  async updateTag(
    tagId: string,
    data: Prisma.WhatsAppConversationTagUpdateInput
  ): Promise<WhatsAppConversationTagSelect> {
    return prisma.whatsAppConversationTag.update({
      where: { id: tagId },
      data,
      select: TAG_SELECT,
    })
  }

  async deleteTag(tagId: string): Promise<void> {
    await prisma.whatsAppConversationTag.delete({ where: { id: tagId } })
  }

  async countTagsForTeam(teamId: string, tagIds: string[]): Promise<number> {
    if (tagIds.length === 0) return 0
    return prisma.whatsAppConversationTag.count({
      where: { teamId, id: { in: tagIds } },
    })
  }

  async replaceConversationTags(conversationId: string, tagIds: string[]): Promise<WhatsAppConversationTagSummary[]> {
    await prisma.$transaction(async (tx) => {
      await tx.whatsAppConversationTagAssignment.deleteMany({
        where: { conversationId },
      })

      if (tagIds.length > 0) {
        await tx.whatsAppConversationTagAssignment.createMany({
          data: tagIds.map((tagId) => ({ conversationId, tagId })),
          skipDuplicates: true,
        })
      }
    })

    const assignments = await prisma.whatsAppConversationTagAssignment.findMany({
      where: { conversationId },
      select: {
        tag: {
          select: {
            id: true,
            name: true,
            color: true,
            sortOrder: true,
          },
        },
      },
    })

    return mapTagAssignmentsToSummaries(assignments)
  }
}

export const whatsAppConversationTagRepository = new WhatsAppConversationTagRepository()

export { isUniqueConstraintError }
