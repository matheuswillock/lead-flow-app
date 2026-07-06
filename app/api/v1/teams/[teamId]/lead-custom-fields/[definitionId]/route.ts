import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { leadCustomFieldsUseCase } from "@/app/api/useCases/leadCustomFields/LeadCustomFieldsUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const optionSchema = z.object({
  value: z.string().trim().min(1, "Valor da opção é obrigatório"),
  label: z.string().trim().min(1, "Rótulo da opção é obrigatório"),
});

const updateDefinitionSchema = z
  .object({
    label: z.string().trim().min(1, "Rótulo é obrigatório").optional(),
    options: z.array(optionSchema).optional(),
    isRequired: z.boolean().optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; definitionId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, definitionId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem gerenciar campos personalizados"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateDefinitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          parsed.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const output = await leadCustomFieldsUseCase.updateDefinition(
      teamAccess.access,
      definitionId,
      parsed.data
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadCustomFieldByIdRoute][PATCH] Erro ao atualizar campo:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar campo personalizado"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; definitionId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, definitionId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem gerenciar campos personalizados"], null),
        { status: 403 }
      );
    }

    const output = await leadCustomFieldsUseCase.deleteDefinition(teamAccess.access, definitionId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadCustomFieldByIdRoute][DELETE] Erro ao remover campo:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover campo personalizado"], null),
      { status: 500 }
    );
  }
}
