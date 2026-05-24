import { NextRequest, NextResponse } from "next/server";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";

// DELETE /api/v1/leads/[id]/attachments/[attachmentId] - Delete an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: leadId, attachmentId } = await params;

    // Verificar autenticação
    const supabase = await createSupabaseServer();
    
    if (!supabase) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["Authentication error"], result: null },
        { status: 401 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["Unauthorized"], result: null },
        { status: 401 }
      );
    }

    const teamIdFromRequest =
      request.headers.get("x-team-id") || new URL(request.url).searchParams.get("teamId");

    const { data: profile } = await supabase
      .from("corretor_studio_profiles")
      .select("id, activeTeamId")
      .eq("supabaseId", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["User profile not found"], result: null },
        { status: 404 }
      );
    }

    const teamId = teamIdFromRequest || profile.activeTeamId;
    if (!teamId) {
      const output = new Output(false, [], ["teamId é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id,
        },
      },
    });

    if (!membership) {
      const output = new Output(false, [], ["Acesso negado para este time"], null);
      return NextResponse.json(output, { status: 403 });
    }
    if (membership.role === "operator" && !membership.functions?.includes("SDR")) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const result = await leadAttachmentUseCase.deleteAttachment(attachmentId, leadId, profile.id);

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });
  } catch (error) {
    console.error("Error in DELETE /api/v1/leads/[id]/attachments/[attachmentId]:", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ["Internal server error"],
        result: null,
      },
      { status: 500 }
    );
  }
}
