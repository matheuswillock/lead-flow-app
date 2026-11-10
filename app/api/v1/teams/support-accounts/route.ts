import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { backofficeSupportAccessUseCase } from "@/app/api/useCases/backofficeSupport/BackofficeSupportAccessUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/** Busca de contas de clientes para o Manager do backoffice (seletor de times). */
export async function GET(request: NextRequest) {
  await connection();

  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), {
        status: 401,
      });
    }

    const query = new URL(request.url).searchParams.get("q") ?? "";
    const output = await backofficeSupportAccessUseCase.searchAccountsForUser(supabaseId, query);

    if (output.isValid) {
      return NextResponse.json(output, { status: 200 });
    }

    const status = output.errorMessages.includes("Perfil não encontrado") ? 404 : output.errorMessages.includes("Acesso negado") ? 403 : 500;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamsSupportAccountsRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
