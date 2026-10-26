import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { validarEmailCreditosUseCase } from "@/app/api/useCases/adquirir/ValidarEmailCreditosUseCase";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { handleValidarCreditos } from "./validarCreditosHandler";

export async function POST(request: NextRequest) {
  try {
    return await handleValidarCreditos(request, {
      getTeamAccess,
      validarCreditos: validarEmailCreditosUseCase,
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[AdquirirCreditosValidarRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao iniciar a contratação."], null),
      { status: 500 },
    );
  }
}
