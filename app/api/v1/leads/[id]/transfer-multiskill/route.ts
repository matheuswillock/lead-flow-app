import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { multiskillTransferUseCase } from "@/app/api/useCases/multiskillTransfer/MultiskillTransferUseCase";
import { TransferMultiskillLeadRequestSchema } from "@/app/api/v1/leads/DTO/requestToTransferMultiskillLead";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.info("[LeadTransferMultiskillRoute][POST] iniciado");

  try {
    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!isManagerOrMaster(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado: somente Master, Manager ou Backoffice"], null),
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = TransferMultiskillLeadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], [parsed.error.issues[0]?.message ?? "Payload inválido"], null),
        { status: 400 }
      );
    }

    const output = await multiskillTransferUseCase.transferLead(teamAccess.access, id, parsed.data);

    const status = output.isValid
      ? 200
      : output.errorMessages.some((message) =>
            message.includes("Acesso negado") || message.includes("não configurada")
          )
        ? 403
        : 400;

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTransferMultiskillRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
