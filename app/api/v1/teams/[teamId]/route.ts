import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { createSupabaseAdmin as createSupabaseAdminClient } from "@/lib/supabase/server";
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase";
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

    const updated = await prisma.$transaction(async (tx) => {
      const existingTeam = await tx.team.findFirst({
        where: {
          id: teamId,
          masterId: teamAccess.access.managerId,
        },
        select: { id: true, name: true, isDefault: true },
      });

      if (!existingTeam) {
        throw new Error("TEAM_NOT_FOUND");
      }

      if (payload.isDefault === false) {
        const otherDefaultTeam = await tx.team.findFirst({
          where: {
            masterId: teamAccess.access.managerId,
            isDefault: true,
            NOT: { id: teamId },
          },
          select: { id: true },
        });

        if (!otherDefaultTeam) {
          throw new Error("CANNOT_UNSET_ONLY_DEFAULT");
        }
      }

      const teamUpdateData: { name?: string; isDefault?: boolean } = {};
      if (payload.name !== undefined) {
        teamUpdateData.name = payload.name.trim();
      }

      if (payload.isDefault === true) {
        await tx.team.updateMany({
          where: { masterId: teamAccess.access.managerId },
          data: { isDefault: false },
        });
        teamUpdateData.isDefault = true;
      } else if (payload.isDefault === false) {
        teamUpdateData.isDefault = false;
      }

      const team = await tx.team.update({
        where: { id: teamId },
        data: teamUpdateData,
        select: { id: true, name: true, isDefault: true },
      });

      if (payload.transferTargetTeamIds) {
        const validTargets = await tx.team.findMany({
          where: {
            id: { in: payload.transferTargetTeamIds },
            masterId: teamAccess.access.managerId,
            NOT: { id: teamId },
          },
          select: { id: true },
        });

        const validTargetIds = validTargets.map((item) => item.id);

        await tx.teamTransferRoute.deleteMany({
          where: { sourceTeamId: teamId },
        });

        if (validTargetIds.length > 0) {
          await tx.teamTransferRoute.createMany({
            data: validTargetIds.map((targetTeamId) => ({
              sourceTeamId: teamId,
              targetTeamId,
              createdBy: teamAccess.access.profileId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return { before: existingTeam, after: team };
    });

    await auditLogWriter.logAudit({
      entityType: "TEAM",
      entityId: teamId,
      action: "UPDATE",
      actorProfileId: teamAccess.access.profileId,
      before: updated.before,
      after: updated.after,
      metadata: { teamId },
    });

    return NextResponse.json(
      new Output(true, ["Time atualizado com sucesso"], [], updated.after),
      { status: 200 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    if (error instanceof Error) {
      if (error.message === "TEAM_NOT_FOUND") {
        return NextResponse.json(new Output(false, [], ["Time não encontrado"], null), { status: 404 });
      }
      if (error.message === "CANNOT_UNSET_ONLY_DEFAULT") {
        return NextResponse.json(
          new Output(
            false,
            [],
            ["Selecione outro time como padrão antes de remover"],
            null
          ),
          { status: 400 }
        );
      }
    }
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

    const [requester, billingOwner] = await Promise.all([
      prisma.profile.findUnique({
        where: { supabaseId },
        select: { id: true, email: true },
      }),
      prisma.profile.findUnique({
        where: { id: teamAccess.access.managerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          cpfCnpj: true,
          phone: true,
          postalCode: true,
          address: true,
          addressNumber: true,
          neighborhood: true,
          complement: true,
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          hasPermanentSubscription: true,
          timezone: true,
        },
      }),
    ]);

    if (!requester || !billingOwner) {
      return NextResponse.json(new Output(false, [], ["Perfil não encontrado"], null), { status: 404 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        new Output(false, [], ["Erro ao validar senha"], null),
        { status: 500 }
      );
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: requester.email,
      password: payload.password,
    });

    if (signInError) {
      return NextResponse.json(new Output(false, [], ["Senha incorreta"], null), { status: 401 });
    }

    const teamSnapshot = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, masterId: true, isDefault: true },
    });

    await prisma.team.delete({ where: { id: teamId } });

    await auditLogWriter.logAudit({
      entityType: "TEAM",
      entityId: teamId,
      action: "DELETE",
      actorProfileId: requester.id,
      before: teamSnapshot,
      after: null,
      metadata: { teamId },
    });

    await memberProBillingUseCase.syncBillingAfterUsageChange(
      billingOwner.id,
      "remove_team"
    );

    return NextResponse.json(
      new Output(true, ["Time deletado com sucesso"], [], { teamId }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro ao deletar time:", error);
    return NextResponse.json(
      new Output(false, [], [error.message || "Erro interno ao deletar time"], null),
      { status: 500 }
    );
  }
}
