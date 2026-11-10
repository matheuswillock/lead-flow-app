import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import {
  teamManagementUseCase,
  TEAM_MANAGEMENT_ERRORS,
} from "@/app/api/useCases/teamManagement/TeamManagementUseCase";
import { invalidatePublicFormBootstrapCache } from "@/lib/cache/invalidation";
import { createSupabaseAdmin as createSupabaseAdminClient } from "@/lib/supabase/server";
import { teamDeletionUseCase } from "@/app/api/useCases/teamDeletion/teamDeletionComposition";
import {
  getTeamAccess,
  hasDelegatedTeamManagementAccess,
} from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { auditLogWriter } from "@/app/api/useCases/audit/AuditLogWriter";

const updateTeamSchema = z
  .object({
    name: z.string().min(2, "Nome do time deve ter pelo menos 2 caracteres").optional(),
    isDefault: z.boolean().optional(),
    transferTargetTeamIds: z.array(z.string().uuid("Time de transferência inválido")).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.isDefault !== undefined ||
      data.transferTargetTeamIds !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

const deleteTeamSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória"),
  /** Gera um ZIP com as informações do time e só então exclui. A exclusão é definitiva em qualquer caso. */
  exportData: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const body = await request.json();
    let payload: z.infer<typeof updateTeamSchema>;
    try {
      payload = updateTeamSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (teamAccess.access.teamId !== teamId) {
      return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), {
        status: 403,
      });
    }

    if (!hasDelegatedTeamManagementAccess(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode editar este time"], null),
        { status: 403 }
      );
    }

    const output = await teamManagementUseCase.updateTeam({
      teamId,
      masterId: teamAccess.access.managerId,
      actorProfileId: teamAccess.access.profileId,
      name: payload.name,
      isDefault: payload.isDefault,
      transferTargetTeamIds: payload.transferTargetTeamIds,
    });

    if (!output.isValid) {
      const firstError = output.errorMessages[0] ?? "";
      const status =
        firstError === TEAM_MANAGEMENT_ERRORS.NOT_FOUND
          ? 404
          : firstError === TEAM_MANAGEMENT_ERRORS.ONLY_DEFAULT
            ? 400
            : 500;
      return NextResponse.json(output, { status });
    }

    // Nome do time e rotas de transferência aparecem no bootstrap do form público.
    invalidatePublicFormBootstrapCache({ teamId });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao atualizar time:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar time"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const body = await request.json();
    let payload: z.infer<typeof deleteTeamSchema>;
    try {
      payload = deleteTeamSchema.parse(body);
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => err.message) || [error.message];
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (teamAccess.access.teamId !== teamId) {
      return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), {
        status: 403,
      });
    }

    if (!hasDelegatedTeamManagementAccess(teamAccess.access)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode excluir este time"], null),
        { status: 403 }
      );
    }

    const actorsOutput = await teamManagementUseCase.findDeletionActors(
      supabaseId,
      teamAccess.access.managerId
    );
    if (!actorsOutput.isValid) {
      return NextResponse.json(actorsOutput, { status: 404 });
    }

    const { requesterId, requesterEmail, billingOwnerId } = actorsOutput.result as {
      requesterId: string;
      requesterEmail: string;
      billingOwnerId: string;
    };

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        new Output(false, [], ["Erro ao validar senha"], null),
        { status: 500 }
      );
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: requesterEmail,
      password: payload.password,
    });

    if (signInError) {
      return NextResponse.json(new Output(false, [], ["Senha incorreta"], null), { status: 401 });
    }

    const exportData = payload.exportData === true;
    const output = await teamDeletionUseCase.requestDeletion({
      teamId,
      requesterProfileId: requesterId,
      requesterEmail,
      billingOwnerId,
      exportData,
    });
    if (!output.isValid) {
      return NextResponse.json(output, { status: 500 });
    }

    if (exportData) {
      // Começa já, sem esperar o próximo ciclo do cron (que continua como rede de segurança).
      after(async () => {
        try {
          await teamDeletionUseCase.processPending();
        } catch (error) {
          console.error("[TeamsRoute][DELETE] Erro ao processar a exportação do time:", error);
        }
      });
      return NextResponse.json(output, { status: 202 });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error: any) {
    console.error("Erro ao deletar time:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno ao deletar time"], null),
      { status: 500 }
    );
  }
}
