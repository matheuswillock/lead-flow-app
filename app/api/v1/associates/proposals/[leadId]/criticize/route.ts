import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getAssociateBackofficeAccess } from "@/app/api/v1/associates/utils/getAssociateBackofficeAccess";
import { associateProposalUseCase } from "@/app/api/useCases/associateProposal/AssociateProposalUseCase";

const criticizeSchema = z.object({
  title: z.string().min(3).max(120),
  message: z.string().min(10).max(2000),
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
    const parsed = criticizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const output = await associateProposalUseCase.criticize(accessResult.access, leadId, parsed.data);
    const httpStatus = (output as Output & { httpStatus?: number }).httpStatus;
    return NextResponse.json(output, { status: output.isValid ? 200 : httpStatus ?? 400 });
  } catch (error) {
    console.error("[AssociateProposalCriticizeRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
