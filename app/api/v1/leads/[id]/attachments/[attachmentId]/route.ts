import { NextRequest, NextResponse } from "next/server";
import { leadAttachmentUseCase } from "@/app/api/useCases/leadAttachments/LeadAttachmentUseCase";
import { createSupabaseServer } from "@/lib/supabase/server";

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

    const result = await leadAttachmentUseCase.deleteAttachment(leadId, attachmentId);

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
