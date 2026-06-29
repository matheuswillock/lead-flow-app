import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const useCase = new RegisterNewUserProfile();

/**
 * GET /api/v1/profiles/by-email?email=<email>
 * Verifica se já existe um profile com o e-mail informado.
 * Retorna 200 se encontrado, 404 se não encontrado.
 * Usado pelo auth callback para evitar criação de usuário órfão no Supabase.
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      const output = new Output(false, [], ["E-mail obrigatorio"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await useCase.checkEmailExists(email);

    if (!result.isValid) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[ProfileByEmailRoute][GET] Erro inesperado:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
