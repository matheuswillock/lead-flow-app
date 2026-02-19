import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadActivityAccess } from "@/app/api/v1/utils/teamAccess";

const reactionSchema = z.object({
  emoji: z.string().min(1, "Emoji é obrigatório"),
  unified: z.string().min(1, "Código do emoji é obrigatório"),
});

type ReactionAggregate = { emoji: string; unified: string; count: number; reactedByMe?: boolean };

const aggregateReactions = (
  reactions: Array<{ emoji: string; emojiUnified: string; profileId: string }>,
  viewerProfileId: string
): ReactionAggregate[] => {
  if (!reactions.length) return [];

  const map = new Map<string, ReactionAggregate>();
  reactions.forEach((reaction) => {
    const unified = reaction.emojiUnified;
    const existing = map.get(unified) || {
      emoji: reaction.emoji,
      unified,
      count: 0,
      reactedByMe: false,
    };

    existing.count += 1;
    if (reaction.profileId === viewerProfileId) {
      existing.reactedByMe = true;
    }

    map.set(unified, existing);
  });

  return Array.from(map.values());
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadActivityAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR ou CLOSER necessária para reagir."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId, activityId } = await params;
    if (!leadId || !activityId) {
      const output = new Output(false, [], ["ID do lead e da atividade são obrigatórios"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    const validation = reactionSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const activity = await prisma.leadActivity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        leadId: true,
        lead: { select: { teamId: true } },
      },
    });

    if (!activity || activity.leadId !== leadId || activity.lead?.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Atividade não encontrada ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const { emoji, unified } = validation.data;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.leadActivityReaction.findUnique({
        where: {
          activityId_profileId_emojiUnified: {
            activityId,
            profileId: teamAccess.access.profileId,
            emojiUnified: unified,
          },
        },
      });

      if (existing) {
        await tx.leadActivityReaction.delete({ where: { id: existing.id } });
      } else {
        await tx.leadActivityReaction.create({
          data: {
            activityId,
            profileId: teamAccess.access.profileId,
            emoji,
            emojiUnified: unified,
          },
        });
      }
    });

    const reactions = await prisma.leadActivityReaction.findMany({
      where: { activityId },
      select: { emoji: true, emojiUnified: true, profileId: true },
    });

    const aggregated = aggregateReactions(reactions, teamAccess.access.profileId);
    const output = new Output(true, ["Reação atualizada"], [], { reactions: aggregated });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao reagir à atividade:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
