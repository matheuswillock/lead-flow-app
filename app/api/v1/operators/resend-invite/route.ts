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

    console.info('📧 [Resend Invite] Enviando email de reset de senha para:', email);

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

    // Enviar email de reset de senha (funciona mesmo se usuário já existe)
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('❌ [Resend Invite] Erro ao enviar email de reset:', error);
      return NextResponse.json(
        new Output(false, [], [`Erro ao enviar email: ${error.message}`], null),
        { status: 500 }
      );
    }

    console.info('✅ [Resend Invite] Email de reset de senha enviado com sucesso');

    return NextResponse.json(
      new Output(true, ['Email de reset de senha enviado com sucesso!'], [], data),
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
