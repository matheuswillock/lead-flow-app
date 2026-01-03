import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { Output } from '@/lib/output';
import { getEmailService } from '@/lib/services/EmailService';

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

    // Import dinâmico do Prisma
    const { default: prismaClient } = await import('../../../infra/data/prisma');

    // Buscar usuário no banco
    const user = await prismaClient.profile.findUnique({
      where: { email },
      select: { id: true, fullName: true, email: true }
    });

    if (!user) {
      return NextResponse.json(
        new Output(false, [], ['Usuário não encontrado'], null),
        { status: 404 }
      );
    }

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

    // Gerar link de reset de senha via Supabase Admin (sem enviar email)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo,
      }
    });

    if (error) {
      console.error('❌ [Resend Invite] Erro ao gerar link de reset:', error);
      return NextResponse.json(
        new Output(false, [], [`Erro ao gerar link: ${error.message}`], null),
        { status: 500 }
      );
    }

    if (!data?.properties?.action_link) {
      console.error('❌ [Resend Invite] Link de reset não foi gerado');
      return NextResponse.json(
        new Output(false, [], ['Erro ao gerar link de recuperação'], null),
        { status: 500 }
      );
    }

    // Enviar email customizado via Resend
    const emailService = getEmailService();
    const emailResult = await emailService.sendPasswordResetEmail(
      user.email,
      user.fullName || user.email,
      data.properties.action_link
    );

    if (!emailResult.success) {
      console.error('❌ [Resend Invite] Erro ao enviar email:', emailResult.error);
      return NextResponse.json(
        new Output(false, [], [`Erro ao enviar email: ${emailResult.error}`], null),
        { status: 500 }
      );
    }

    console.info('✅ [Resend Invite] Email de reset de senha enviado com sucesso via Resend');

    return NextResponse.json(
      new Output(true, ['Email de reset de senha enviado com sucesso!'], [], { 
        emailId: emailResult.data 
      }),
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
