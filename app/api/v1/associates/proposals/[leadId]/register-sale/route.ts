import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getAssociateBackofficeAccess } from "@/app/api/v1/associates/utils/getAssociateBackofficeAccess";
import { associateProposalUseCase } from "@/app/api/useCases/associateProposal/AssociateProposalUseCase";

const registerSaleSchema = z.object({
  operatorName: z.string().min(2).max(120),
  proposalNumber: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const accessResult = await getAssociateBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const { leadId } = await params;
    const body = await request.json();
    const parsed = registerSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await associateProposalUseCase.registerSale(accessResult.access, leadId, parsed.data);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[AssociateProposalRegisterSaleRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
