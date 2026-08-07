import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { crossAccountMembersUseCase } from "@/app/api/useCases/crossAccountMembers/CrossAccountMembersUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  await connection();

  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["ID do usuário é obrigatório"], null),
        { status: 401 }
      );
    }

    const email = new URL(request.url).searchParams.get("email") ?? "";
    const { teamId } = await params;

    const output = await crossAccountMembersUseCase.lookupProfileByEmail(
      supabaseId,
      teamId,
      email
    );

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamExternalMembersLookupRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
