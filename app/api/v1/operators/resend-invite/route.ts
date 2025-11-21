import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { Output } from '@/lib/output';

/**
 * POST /api/v1/operators/resend-invite
 * Reenvia convite por e-mail para um operador
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId } = body;

    if (!email) {
      return NextResponse.json(
        new Output(false, [], ['E-mail é obrigatório'], null),
        { status: 400 }
      );
    }

    console.info('📧 [Resend Invite] Reenviando convite para:', email);

    // Criar cliente Supabase Admin
    const supabase = createSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        new Output(false, [], ['Erro ao conectar com sistema de autenticação'], null),
        { status: 500 }
      );
    }

    // Configurar redirect URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectTo = `${appUrl}/set-password`;

    // Reenviar convite
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('❌ [Resend Invite] Erro ao reenviar convite:', error);
      return NextResponse.json(
        new Output(false, [], [`Erro ao reenviar convite: ${error.message}`], null),
        { status: 500 }
      );
    }

    console.info('✅ [Resend Invite] Convite reenviado com sucesso');

    return NextResponse.json(
      new Output(true, ['Convite reenviado com sucesso!'], [], data),
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [Resend Invite] Erro inesperado:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro inesperado ao reenviar convite'], null),
      { status: 500 }
    );
  }
}
