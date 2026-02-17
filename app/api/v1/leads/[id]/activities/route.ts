import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadActivityAccess } from "@/app/api/v1/utils/teamAccess";

const activitySchema = z.object({
  type: z.enum(["note", "call", "whatsapp", "email"]),
  body: z.string().min(1, "Mensagem é obrigatória"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadActivityAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR ou CLOSER necessária para registrar atividades."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    const validation = activitySchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const activity = await prisma.leadActivity.create({
      data: {
        leadId,
        type: validation.data.type as ActivityType,
        body: validation.data.body.trim(),
        createdBy: teamAccess.access.profileId,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
      },
    });

    const output = new Output(true, ["Atividade adicionada com sucesso"], [], activity);
    return NextResponse.json(output, { status: 201 });
  } catch (error) {
    console.error("Erro ao adicionar atividade:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
