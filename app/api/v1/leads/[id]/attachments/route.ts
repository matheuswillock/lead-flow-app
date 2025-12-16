import { NextRequest, NextResponse } from "next/server";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { createSupabaseServer } from "@/lib/supabase/server";

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

    // Buscar profile do usuário para pegar o ID correto
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("supabaseId", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["User profile not found"], result: null },
        { status: 404 }
      );
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
    console.error("Error in POST /api/v1/leads/[id]/attachments:", error);
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
