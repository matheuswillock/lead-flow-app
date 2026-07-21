import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getAssociateBackofficeAccess } from "@/app/api/v1/associates/utils/getAssociateBackofficeAccess";
import { associateProposalUseCase } from "@/app/api/useCases/associateProposal/AssociateProposalUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const VALID_DOCUMENT_TYPES = ["rg", "address_proof", "social_contract"] as const;
type ValidDocumentType = (typeof VALID_DOCUMENT_TYPES)[number];

function isValidDocumentType(value: string): value is ValidDocumentType {
  return VALID_DOCUMENT_TYPES.includes(value as ValidDocumentType);
}

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

    const output = await associateProposalUseCase.approveDocument(
      accessResult.access,
      leadId,
      documentType
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[AssociateProposalApproveDocumentRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
