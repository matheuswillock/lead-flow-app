import { NextRequest, NextResponse } from "next/server";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";

// GET /api/v1/leads/[id]/attachments - List all attachments for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

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
      .from("profiles")
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

    const result = await leadAttachmentUseCase.listAttachments(leadId);

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 });
  } catch (error) {
    console.error("Error in GET /api/v1/leads/[id]/attachments:", error);
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

// POST /api/v1/leads/[id]/attachments - Upload a new attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  try {

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

    // Buscar profile do usuário para pegar o ID correto
    const { data: profile } = await supabase
      .from("profiles")
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

    // Extrair arquivo do FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["No file provided"], result: null },
        { status: 400 }
      );
    }

    const result = await leadAttachmentUseCase.uploadAttachment(leadId, file, profile.id);

    return NextResponse.json(result, { status: result.isValid ? 201 : 400 });
  } catch (error) {
    console.error("[LeadAttachmentsRoute][POST] Erro ao fazer upload de anexo:", { leadId, error });
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
