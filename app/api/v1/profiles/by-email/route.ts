import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

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

    const profile = await profileRepository.findByEmail(email);

    if (!profile) {
      const output = new Output(false, [], ["Profile nao encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    return NextResponse.json(new Output(true, ["Profile encontrado"], [], { exists: true }), { status: 200 });
  } catch (error) {
    console.error("[ProfileByEmailRoute][GET] Erro inesperado:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
