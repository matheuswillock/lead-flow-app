import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado para buscar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    if (!q) {
      return NextResponse.json(new Output(true, [], [], []), { status: 200 });
    }

    const output = await leadUseCase.getAllLeadsByUserRole(teamAccess.access.supabaseId, {
      role: teamAccess.access.teamMember.role,
      teamId: teamAccess.access.teamId,
      search: q,
    });
    if (!output.isValid) {
      return NextResponse.json(output, { status: 400 });
    }

    const rawLeads = Array.isArray(output.result) ? output.result : [];
    const leads = rawLeads
      .map((lead) => {
        if (!lead || typeof lead !== "object") return null;
        const item = lead as { id?: string; name?: string; phone?: string | null };
        if (!item.id || !item.name) return null;
        return { id: item.id, name: item.name, phone: item.phone ?? null };
      })
      .filter((item): item is { id: string; name: string; phone: string | null } => Boolean(item))
      .slice(0, 20);

    return NextResponse.json(new Output(true, [], [], leads), { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadSearchRoute][GET] Erro ao buscar leads:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
