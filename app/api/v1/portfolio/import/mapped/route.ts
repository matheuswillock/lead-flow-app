import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { invalidatePortfolioCache } from "@/lib/cache/invalidation";
import { importMappedPortfolioClientsUseCase } from "@/app/api/useCases/portfolio/ImportMappedPortfolioClientsUseCase";
import { MappedPortfolioImportRequestSchema } from "./DTO/mappedPortfolioImportRequest";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { profileId, teamId, teamMember } = teamAccess.access;
    const isManager = isManagerLikeRole(teamMember.role);
    const isCloser = teamMember.functions.includes("CLOSER");

    if (!isManager && !isCloser) {
      const output = new Output(
        false,
        [],
        ["Acesso negado: somente managers ou closers podem importar clientes na carteira"],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = MappedPortfolioImportRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Payload inválido";
      const output = new Output(false, [], [message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await importMappedPortfolioClientsUseCase.execute(
      { teamId, profileId },
      parsed.data
    );

    if (!output.isValid) {
      return NextResponse.json(output, { status: 400 });
    }

    if ((output.result?.created ?? 0) > 0) {
      invalidatePortfolioCache({ teamId });
    }

    return NextResponse.json(output);
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PortfolioImportMappedRoute][POST] Erro ao importar clientes:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
