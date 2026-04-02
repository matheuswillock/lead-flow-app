import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const supabaseId = url.searchParams.get("supabaseId");
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["teamId é obrigatório"], null),
        { status: 400 }
      );
    }

    const output = await publicLeadFormUseCase.getTeamClosers(teamId, supabaseId ?? undefined);
    if (!output.isValid) {
      const normalizedErrors = output.errorMessages.join(" ").toLowerCase();
      const status =
        normalizedErrors.includes("não encontrado") || normalizedErrors.includes("nao encontrado")
          ? 404
          : normalizedErrors.includes("não pertence ao time") || normalizedErrors.includes("nao pertence ao time")
            ? 404
            : 400;

      return NextResponse.json(output, { status });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("[IntegrationTeamClosersRoute][GET] Erro ao listar closers:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao listar closers do time"], null),
      { status: 500 }
    );
  }
}
