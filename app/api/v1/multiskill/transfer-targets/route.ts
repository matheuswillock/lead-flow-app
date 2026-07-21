import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";
import { multiskillTransferUseCase } from "@/app/api/useCases/multiskillTransfer/MultiskillTransferUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const listSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  console.info("[MultiskillTransferTargetsRoute][GET] iniciado");

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

    const { searchParams } = new URL(request.url);
    const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], [parsed.error.issues[0]?.message ?? "Parâmetros inválidos"], null),
        { status: 400 }
      );
    }

    const output = await multiskillTransferUseCase.listTransferTargets(teamAccess.access, {
      query: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    const status = output.isValid
      ? 200
      : output.errorMessages.some((message) => message.includes("Acesso negado"))
        ? 403
        : 400;

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[MultiskillTransferTargetsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
