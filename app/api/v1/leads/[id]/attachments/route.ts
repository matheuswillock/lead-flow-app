import { NextRequest, NextResponse } from "next/server";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";

// GET /api/v1/leads/[id]/attachments - List all attachments for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

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

    const result = await leadAttachmentUseCase.listAttachments(leadId);
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[LeadAttachmentsRoute][GET] Erro ao listar anexos:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}

// POST /api/v1/leads/[id]/attachments - Upload a new attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  try {
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        new Output(false, [], ["Nenhum arquivo fornecido"], null),
        { status: 400 }
      );
    }

    const result = await leadAttachmentUseCase.uploadAttachment(leadId, file, profile.id);
    return NextResponse.json(result, { status: result.isValid ? 201 : 400 });
  } catch (error) {
    console.error("[LeadAttachmentsRoute][POST] Erro ao fazer upload de anexo:", { leadId, error });
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
