import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";

const connectSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
  email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuario e obrigatorio"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const body = await request.json();
    const validation = connectSchema.safeParse(body);

    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => issue.message),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { accessToken, refreshToken, expiresAt, email } = validation.data;

    const profile = await profileRepository.updateGoogleCalendarAuth(supabaseId, {
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      email: email ?? null,
      connected: Boolean(refreshToken || accessToken),
    });

    if (!profile) {
      const output = new Output(false, [], ["Falha ao salvar credenciais Google"], null);
      return NextResponse.json(output, { status: 400 });
    }

    return NextResponse.json(new Output(true, ["Google conectado"], [], null), { status: 200 });
  } catch (error) {
    console.error("Erro ao conectar Google:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
