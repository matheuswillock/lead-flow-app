import { NextRequest, NextResponse } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import { leadTagUseCase } from "@/app/api/useCases/leads/LeadTagUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const result = await leadTagUseCase.listTeamTags(teamAccess.access.teamId);
    if (!result.isValid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result.result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTagsRoute][GET] Erro ao listar tags:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = await request.json();
    const { name, color } = body as { name?: string; color?: string };

    if (!name || !color) {
      const output = new Output(false, [], ["name e color são obrigatórios"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await leadTagUseCase.createTeamTag(
      teamAccess.access.teamId,
      teamAccess.access.profileId,
      name,
      color
    );

    if (!result.isValid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result.result, { status: 201 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTagsRoute][POST] Erro ao criar tag:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
