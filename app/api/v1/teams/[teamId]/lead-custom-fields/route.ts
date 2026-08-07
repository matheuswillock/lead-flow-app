import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { leadCustomFieldsUseCase } from "@/app/api/useCases/leadCustomFields/LeadCustomFieldsUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const leadCustomFieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "boolean",
]);

const optionSchema = z.object({
  value: z.string().trim().min(1, "Valor da opção é obrigatório"),
  label: z.string().trim().min(1, "Rótulo da opção é obrigatório"),
});

const createDefinitionSchema = z.object({
  label: z.string().trim().min(1, "Rótulo é obrigatório"),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,63}$/, "Chave deve estar em kebab-case/snake_case")
    .optional(),
  type: leadCustomFieldTypeSchema,
  options: z.array(optionSchema).optional(),
  isRequired: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  showOnPublicForm: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const output = await leadCustomFieldsUseCase.listDefinitions(
      teamAccess.access,
      includeInactive
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadCustomFieldsRoute][GET] Erro ao listar campos:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar campos personalizados"], null),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
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
    const parsed = createDefinitionSchema.safeParse(body);
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

    const output = await leadCustomFieldsUseCase.createDefinition(teamAccess.access, parsed.data);
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadCustomFieldsRoute][POST] Erro ao criar campo:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao criar campo personalizado"], null),
      { status: 500 }
    );
  }
}
