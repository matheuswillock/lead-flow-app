import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../useCases/profiles/ProfileUseCase";
import { CreateLeadRequestSchema } from "./DTO/requestToCreateLead";
import { Output } from "@/lib/output";
import { LeadStatus } from "@prisma/client";
import { invalidateLeadCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const supabaseId = request.headers.get('x-supabase-user-id') || body.supabaseId;
    const teamId = request.headers.get('x-team-id') || body.teamId;
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }
    if (!teamId) {
      const output = new Output(false, [], ["Team ID é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    let validatedData;
    try {
      validatedData = CreateLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadUseCase.createLead(supabaseId, validatedData, teamId);
    if (output.isValid && output.result && typeof output.result === "object" && "id" in output.result) {
      invalidateLeadCache({ leadId: (output.result as { id: string }).id, teamId });
    }
    const status = output.isValid ? 201 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadsRoute][POST] Erro ao criar lead:", {
      error: error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : error,
    });

    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      const target = (error as { meta?: { target?: string[] } }).meta?.target;
      const isCnpjDup = Array.isArray(target) && target.includes("cnpj");
      const msg = isCnpjDup
        ? "Já existe um lead com este CNPJ neste time"
        : "Conflito de unicidade: " + (target?.join(", ") ?? "campo duplicado");
      const output = new Output(false, [], [msg], null);
      return NextResponse.json(output, { status: 409 });
    }

    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.info('[LeadsRoute][GET] Received GET request');

    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const status = searchParams.get('status') as LeadStatus | null;
    const assignedTo = searchParams.get('assignedTo');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const onlyTransfer = searchParams.get('onlyTransfer') === 'true';
    const calendarWindowStart = searchParams.get('calendarWindowStart');
    const calendarWindowEnd = searchParams.get('calendarWindowEnd');

    if (!role) {
      console.warn('[LeadsRoute][GET] No role in query params');
      const output = new Output(false, [], ["Role do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const options = {
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(search && { search }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(onlyTransfer && { onlyTransfer }),
      ...(calendarWindowStart && calendarWindowEnd && {
        calendarWindowStart: new Date(calendarWindowStart),
        calendarWindowEnd: new Date(calendarWindowEnd),
      }),
    };

    const output = await leadUseCase.getAllLeadsByUserRoleWithCtx(access, options);

    return NextResponse.json(output);

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadsRoute][GET] Erro ao buscar leads:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
