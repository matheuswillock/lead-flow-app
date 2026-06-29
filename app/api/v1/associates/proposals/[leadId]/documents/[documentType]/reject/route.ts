import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getAssociateBackofficeAccess } from "@/app/api/v1/associates/utils/getAssociateBackofficeAccess";
import { associateProposalUseCase } from "@/app/api/useCases/associateProposal/AssociateProposalUseCase";

const VALID_DOCUMENT_TYPES = ["rg", "address_proof", "social_contract"] as const;
type ValidDocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

function isValidDocumentType(value: string): value is ValidDocumentType {
  return VALID_DOCUMENT_TYPES.includes(value as ValidDocumentType);
}

const rejectSchema = z.object({
  reason: z.string().min(5).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string; documentType: string }> }
) {
  try {
    const accessResult = await getAssociateBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const { leadId, documentType } = await params;
    if (!isValidDocumentType(documentType)) {
      return NextResponse.json(new Output(false, [], ["Tipo de documento inválido"], null), { status: 400 });
    }

    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await associateProposalUseCase.rejectDocument(
      accessResult.access,
      leadId,
      documentType,
      parsed.data.reason
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[AssociateProposalRejectDocumentRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
