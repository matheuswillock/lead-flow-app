import { after, NextRequest, NextResponse, connection } from "next/server";
import { UpdateLeadRequestSchema } from "../DTO/requestToUpdateLead";
import { Output } from "@/lib/output";
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseInstance";
import {
  authorizeLeadAccessUseCase,
  type AuthorizeLeadAccessInput,
  type LeadAuthorizationSnapshot,
} from "@/app/api/useCases/leads/AuthorizeLeadAccessUseCase";
import { invalidateLeadCache, invalidateLeadFullCache } from "@/lib/cache/invalidation";
import {
  getTeamAccess,
  hasLeadActivityAccess,
  isManagerOrMaster,
  type TeamAccess,
} from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const LEAD_FUNCTION_DENIED_MESSAGE =
  "Acesso negado: funcao SDR ou Closer necessaria para visualizar leads.";

/**
 * Resolve autorizacao de time para as rotas de lead.
 *
 * Antes cada handler repetia `profile.findUnique` + `teamMember.findUnique` na
 * mao, o que (a) violava a regra de resolucao unica de TeamContext e (b) pulava
 * as checagens de conta banida e assinatura inativa que o getTeamAccess faz.
 */
async function resolveLeadRouteAccess(
  request: NextRequest
): Promise<{ access: TeamAccess } | { error: Output; status: number }> {
  const teamAccess = await getTeamAccess(request);
  if (teamAccess.error) {
    return { error: teamAccess.error, status: teamAccess.status };
  }

  if (!hasLeadActivityAccess(teamAccess.access.teamMember)) {
    return {
      error: new Output(false, [], [LEAD_FUNCTION_DENIED_MESSAGE], null),
      status: 403,
    };
  }

  return { access: teamAccess.access };
}

/** Traduz o Output do use case de autorizacao no par lead/erro que a rota usa. */
async function resolveAuthorizedLead(
  access: TeamAccess,
  leadId: string,
  allowTransferredFromTeam: AuthorizeLeadAccessInput["allowTransferredFromTeam"]
): Promise<{ lead: LeadAuthorizationSnapshot } | { error: Output; status: number }> {
  const output = await authorizeLeadAccessUseCase.execute({
    leadId,
    teamId: access.teamId,
    profileId: access.profileId,
    allowTransferredFromTeam,
  });

  if (!output.isValid) {
    return { error: output, status: 404 };
  }

  return { lead: output.result as LeadAuthorizationSnapshot };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();

  try {
    const routeAccess = await resolveLeadRouteAccess(request);
    if ("error" in routeAccess) {
      return NextResponse.json(routeAccess.error, { status: routeAccess.status });
    }

    const { access } = routeAccess;
    const { id } = await params;

    const authorized = await resolveAuthorizedLead(
      access,
      id,
      isManagerOrMaster(access)
    );
    if ("error" in authorized) {
      return NextResponse.json(authorized.error, { status: authorized.status });
    }

    const output = await leadUseCase.getLeadById(access.supabaseId, id);
    const status = output.isValid ? 200 : (output.errorMessages.includes("Lead não encontrado") ? 404 : 400);
    return NextResponse.json(output, { status });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao buscar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const routeAccess = await resolveLeadRouteAccess(request);
    if ("error" in routeAccess) {
      return NextResponse.json(routeAccess.error, { status: routeAccess.status });
    }

    const { access } = routeAccess;
    const { teamId, profileId, teamMember } = access;

    const body = await request.json();

    let validatedData;
    try {
      validatedData = UpdateLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;

    const authorized = await resolveAuthorizedLead(access, id, false);
    if ("error" in authorized) {
      return NextResponse.json(authorized.error, { status: authorized.status });
    }

    const { lead } = authorized;
    // access.managerId ja e o masterId do time da requisicao (teamAccess.ts),
    // entao a consulta a tabela team que existia aqui era redundante.
    const isTeamMaster = access.managerId === profileId;
    const wantsMeetingHealdUpdate = Object.prototype.hasOwnProperty.call(body, "meetingHeald");

    if (wantsMeetingHealdUpdate) {
      const isAssignedCloser = !!lead.closerId && lead.closerId === profileId;
      const canMarkMeetingHeald =
        isTeamMaster || (teamMember.functions?.includes("CLOSER") && isAssignedCloser);

      if (lead.status !== "scheduled") {
        const output = new Output(false, [], ["Reuniao so pode ser marcada como realizada para leads agendados."], null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!canMarkMeetingHeald) {
        const output = new Output(false, [], ["Acesso negado: somente o closer do lead (ou master) pode marcar reuniao como realizada."], null);
        return NextResponse.json(output, { status: 403 });
      }
    }

    const wantsMeetingPresenceUpdate = Object.prototype.hasOwnProperty.call(body, "meetingPresenceConfirmed");

    if (wantsMeetingPresenceUpdate && body.meetingPresenceConfirmed === true) {
      const isManagerLike = isManagerLikeRole(teamMember.role);
      const isAssignedSdr = !!lead.assignedTo && lead.assignedTo === profileId;
      const isAssignedCloser = !!lead.closerId && lead.closerId === profileId;
      const canConfirmPresence =
        isTeamMaster ||
        isManagerLike ||
        isAssignedSdr ||
        (teamMember.functions?.includes("CLOSER") && isAssignedCloser) ||
        (teamMember.functions?.includes("SDR") && isAssignedSdr);

      if (lead.status !== "scheduled") {
        const output = new Output(false, [], ["Só é possível confirmar agenda para leads agendados."], null);
        return NextResponse.json(output, { status: 400 });
      }

      if (lead.isTransfer) {
        const output = new Output(false, [], ["Pré-agendamento de transferência não pode ser confirmado como agenda."], null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!lead.meetingDate || lead.meetingDate.getTime() <= Date.now()) {
        const output = new Output(false, [], ["Só é possível confirmar agenda antes do horário da reunião."], null);
        return NextResponse.json(output, { status: 400 });
      }

      if (!canConfirmPresence) {
        const output = new Output(false, [], ["Acesso negado: somente o SDR, closer ou gestor do lead pode confirmar a agenda."], null);
        return NextResponse.json(output, { status: 403 });
      }
    }

    const output = await leadUseCase.updateLead(access.supabaseId, id, validatedData);
    if (output.isValid) {
      invalidateLeadCache({ leadId: id, teamId });

      const updated = output.result as { cnpj?: string | null; razaoSocial?: string | null } | null;
      if (validatedData.cnpj !== undefined && updated?.cnpj && !updated?.razaoSocial) {
        after(async () => {
          await leadUseCase.enrichLeadRazaoSocial(id, updated.cnpj as string);
          invalidateLeadCache({ leadId: id, teamId });
        });
      }
    }
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao atualizar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const routeAccess = await resolveLeadRouteAccess(request);
    if ("error" in routeAccess) {
      return NextResponse.json(routeAccess.error, { status: routeAccess.status });
    }

    const { access } = routeAccess;
    const { teamId } = access;
    const { id } = await params;

    const authorized = await resolveAuthorizedLead(access, id, false);
    if ("error" in authorized) {
      return NextResponse.json(authorized.error, { status: authorized.status });
    }

    const output = await leadUseCase.deleteLead(access.supabaseId, id);
    if (output.isValid) {
      invalidateLeadFullCache({ leadId: id, teamId });
    }
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao excluir lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
