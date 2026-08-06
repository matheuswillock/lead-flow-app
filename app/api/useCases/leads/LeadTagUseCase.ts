import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { Prisma } from "@prisma/client";
import { ILeadTagUseCase } from "./ILeadTagUseCase";

class LeadTagUseCase implements ILeadTagUseCase {
  async listTeamTags(teamId: string): Promise<Output> {
    try {
      console.info("[LeadTagUseCase][listTeamTags] teamId:", teamId);
      const tags = await prisma.leadTag.findMany({
        where: { teamId },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          teamId: true,
          name: true,
          color: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return new Output(true, [], [], tags);
    } catch (error) {
      console.error("[LeadTagUseCase][listTeamTags] Erro:", error);
      return new Output(false, [], ["Erro ao listar tags do time"], null);
    }
  }

  async createTeamTag(teamId: string, profileId: string, name: string, color: string): Promise<Output> {
    try {
      console.info("[LeadTagUseCase][createTeamTag] teamId:", teamId, "profileId:", profileId);
      if (!name || name.trim().length === 0) {
        return new Output(false, [], ["Nome da tag é obrigatório"], null);
      }
      if (!color || color.trim().length === 0) {
        return new Output(false, [], ["Cor da tag é obrigatória"], null);
      }

      const lastTag = await prisma.leadTag.findFirst({
        where: { teamId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });

      const sortOrder = (lastTag?.sortOrder ?? 0) + 1;

      const tag = await prisma.leadTag.create({
        data: {
          teamId,
          name: name.trim(),
          color: color.trim(),
          sortOrder,
        },
        select: {
          id: true,
          teamId: true,
          name: true,
          color: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return new Output(true, ["Tag criada com sucesso"], [], tag);
    } catch (error) {
      console.error("[LeadTagUseCase][createTeamTag] Erro:", error);
      return new Output(false, [], ["Erro ao criar tag"], null);
    }
  }

  async deleteTeamTag(teamId: string, tagId: string): Promise<Output> {
    try {
      console.info("[LeadTagUseCase][deleteTeamTag] teamId:", teamId, "tagId:", tagId);
      const tag = await prisma.leadTag.findUnique({
        where: { id: tagId },
        select: { id: true, teamId: true },
      });

      if (!tag || tag.teamId !== teamId) {
        return new Output(false, [], ["Tag não encontrada ou sem permissão"], null);
      }

      await prisma.leadTagAssignment.deleteMany({ where: { tagId } });
      await prisma.leadTag.delete({ where: { id: tagId } });

      return new Output(true, ["Tag removida com sucesso"], [], null);
    } catch (error) {
      console.error("[LeadTagUseCase][deleteTeamTag] Erro:", error);
      return new Output(false, [], ["Erro ao remover tag"], null);
    }
  }

  async listLeadTags(leadId: string, teamId: string): Promise<Output> {
    try {
      console.info("[LeadTagUseCase][listLeadTags] leadId:", leadId, "teamId:", teamId);
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, teamId: true },
      });

      if (!lead || lead.teamId !== teamId) {
        return new Output(false, [], ["Lead não encontrado ou sem permissão"], null);
      }

      const assignments = await prisma.leadTagAssignment.findMany({
        where: { leadId },
        select: {
          id: true,
          leadId: true,
          tagId: true,
          createdAt: true,
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return new Output(true, [], [], assignments);
    } catch (error) {
      console.error("[LeadTagUseCase][listLeadTags] Erro:", error);
      return new Output(false, [], ["Erro ao listar tags do lead"], null);
    }
  }

  async applyTagToLead(leadId: string, tagId: string, teamId: string): Promise<Output> {
    try {
      console.info("[LeadTagUseCase][applyTagToLead] leadId:", leadId, "tagId:", tagId, "teamId:", teamId);
      const tag = await prisma.leadTag.findUnique({
        where: { id: tagId },
        select: { id: true, teamId: true },
      });

      if (!tag || tag.teamId !== teamId) {
        return new Output(false, [], ["Tag não encontrada ou sem permissão"], null);
      }

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, teamId: true },
      });

      if (!lead || lead.teamId !== teamId) {
        return new Output(false, [], ["Lead não encontrado ou sem permissão"], null);
      }

      try {
        const assignment = await prisma.leadTagAssignment.create({
          data: { leadId, tagId },
          select: {
            id: true,
            leadId: true,
            tagId: true,
            createdAt: true,
          },
        });
        return new Output(true, ["Tag aplicada com sucesso"], [], assignment);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const existing = await prisma.leadTagAssignment.findUnique({
            where: { leadId_tagId: { leadId, tagId } },
            select: {
              id: true,
              leadId: true,
              tagId: true,
              createdAt: true,
            },
          });
          return new Output(true, ["Tag já aplicada ao lead"], [], existing);
        }
        throw err;
      }
    } catch (error) {
      console.error("[LeadTagUseCase][applyTagToLead] Erro:", error);
      return new Output(false, [], ["Erro ao aplicar tag ao lead"], null);
    }
  }

  async removeTagFromLead(leadId: string, tagId: string, teamId: string): Promise<Output> {
    try {
      console.info("[LeadTagUseCase][removeTagFromLead] leadId:", leadId, "tagId:", tagId, "teamId:", teamId);
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, teamId: true },
      });

      if (!lead || lead.teamId !== teamId) {
        return new Output(false, [], ["Lead não encontrado ou sem permissão"], null);
      }

      await prisma.leadTagAssignment.deleteMany({ where: { leadId, tagId } });

      return new Output(true, ["Tag removida do lead com sucesso"], [], null);
    } catch (error) {
      console.error("[LeadTagUseCase][removeTagFromLead] Erro:", error);
      return new Output(false, [], ["Erro ao remover tag do lead"], null);
    }
  }
}

export const leadTagUseCase = new LeadTagUseCase();
