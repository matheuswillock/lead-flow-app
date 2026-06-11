import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { importMappedLeadsUseCase } from "@/app/api/useCases/leads/ImportMappedLeadsUseCase";
import { MappedImportRequestSchema } from "./DTO/mappedImportRequest";

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado para importar leads"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = MappedImportRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Dados de importação inválidos";
      const output = new Output(false, [], [message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await importMappedLeadsUseCase.execute(
      {
        supabaseId: teamAccess.access.supabaseId,
        teamId: teamAccess.access.teamId,
      },
      parsed.data.rows
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[LeadsImportMappedRoute][POST] Erro ao importar leads:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
