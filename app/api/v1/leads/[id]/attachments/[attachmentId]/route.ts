import { NextRequest, NextResponse } from "next/server";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";

// DELETE /api/v1/leads/[id]/attachments/[attachmentId] - Delete an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: leadId, attachmentId } = await params;

    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["ID do usuário é obrigatório"], null),
        { status: 401 }
      );
    }

    const teamIdFromRequest =
      request.headers.get("x-team-id") || new URL(request.url).searchParams.get("teamId");

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, activeTeamId: true },
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ["Perfil não encontrado"], null),
        { status: 404 }
      );
    }

    const teamId = teamIdFromRequest || profile.activeTeamId;
    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["teamId é obrigatório"], null),
        { status: 400 }
      );
    }

    const [membership, lead] = await Promise.all([
      prisma.teamMember.findUnique({
        where: { teamId_profileId: { teamId, profileId: profile.id } },
      }),
      prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, teamId: true },
      }),
    ]);

    if (!membership) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }
    if (membership.role === "operator" && !membership.functions?.includes("SDR")) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null),
        { status: 403 }
      );
    }

    if (!lead || lead.teamId !== teamId) {
      return NextResponse.json(
        new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null),
        { status: 404 }
      );
    }

    const result = await leadAttachmentUseCase.deleteAttachment(attachmentId, leadId, profile.id);
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[LeadAttachmentByIdRoute][DELETE] Erro ao deletar anexo:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
