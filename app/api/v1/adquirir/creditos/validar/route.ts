import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { validarEmailCreditosUseCase } from "@/app/api/useCases/adquirir/ValidarEmailCreditosUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.email !== "string" || typeof body.plan !== "string") {
      return NextResponse.json(
        new Output(false, [], ["Informe um e-mail válido e um plano."], null),
        { status: 400 },
      );
    }

    const output = await validarEmailCreditosUseCase.execute({
      email: body.email,
      plan: body.plan as "25k" | "50k",
    });

    if (!output.isValid) {
      const isNotFound = output.errorMessages.some((message) => message.includes("não encontrado"));
      return NextResponse.json(output, { status: isNotFound ? 404 : 400 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[AdquirirCreditosValidarRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao validar e-mail."], null),
      { status: 500 },
    );
  }
}
