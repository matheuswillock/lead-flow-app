import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { crossAccountMembersUseCase } from "@/app/api/useCases/crossAccountMembers/CrossAccountMembersUseCase";
import { z } from "zod";

const InviteExternalMemberSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum(["manager", "backoffice", "operator"]).default("operator"),
  functions: z.array(z.enum(["SDR", "CLOSER"])).default([]),
  canCreateAccountUsers: z.boolean().optional(),
  canManageAccountTeams: z.boolean().optional(),
  canTransferAccountLeads: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["ID do usuário é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = InviteExternalMemberSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((item) => item.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const output = await crossAccountMembersUseCase.inviteExternalMember(
      supabaseId,
      teamId,
      parsed.data
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[TeamExternalMembersRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
