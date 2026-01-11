import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { Output } from '@/lib/output';
import { getEmailService } from '@/lib/services/EmailService';
import { prisma } from '@/app/api/infra/data/prisma';

/**
 * POST /api/v1/auth/forgot-password
 * Envia e-mail de recuperação de senha para usuário
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validação básica
    if (!email) {
      return NextResponse.json(
        new Output(false, [], ['E-mail é obrigatório'], null),
        { status: 400 }
      );
    }

    // Validação de formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        new Output(false, [], ['Formato de e-mail inválido'], null),
        { status: 400 }
      );
    }

    console.info('🔐 [Forgot Password] Solicitação de reset de senha para:', email);

    // Buscar usuário no banco de dados
    const user = await prisma.profile.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        supabaseId: true
      }
    });

    // Por segurança, retorna sucesso mesmo se usuário não existir
    // Isso evita enumerar usuários válidos no sistema
    if (!user) {
      console.info('⚠️ [Forgot Password] Usuário não encontrado, mas retornando sucesso por segurança');
      return NextResponse.json(
        new Output(
          true, 
          ['Se o e-mail estiver cadastrado, você receberá as instruções de recuperação'], 
          [], 
          null
        ),
        { status: 200 }
      );
    }

    // Verificar se usuário tem supabaseId
    if (!user.supabaseId) {
      console.error('❌ [Forgot Password] Usuário sem supabaseId:', user.email);
      return NextResponse.json(
        new Output(
          false, 
          [], 
          ['Erro ao processar solicitação. Entre em contato com o suporte.'], 
          null
        ),
        { status: 500 }
      );
    }

    // Criar cliente Supabase Admin
    const supabase = createSupabaseAdmin();
    if (!supabase) {
      console.error('❌ [Forgot Password] Erro ao criar cliente Supabase Admin');
      return NextResponse.json(
        new Output(
          false, 
          [], 
          ['Erro ao conectar com sistema de autenticação'], 
          null
        ),
        { status: 500 }
      );
    }

    // Configurar redirect URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectTo = `${appUrl}/set-password`;

    console.info('🔄 [Forgot Password] Gerando link de recuperação via Supabase Admin...');

    // Gerar link de recuperação de senha via Supabase Admin
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
      options: {
        redirectTo,
      }
    });

    if (error) {
      console.error('❌ [Forgot Password] Erro ao gerar link de recuperação:', error);
      return NextResponse.json(
        new Output(
          false, 
          [], 
          [`Erro ao gerar link de recuperação: ${error.message}`], 
          null
        ),
        { status: 500 }
      );
    }

    if (!data?.properties?.action_link) {
      console.error('❌ [Forgot Password] Link de recuperação não foi gerado');
      return NextResponse.json(
        new Output(
          false, 
          [], 
          ['Erro ao gerar link de recuperação'], 
          null
        ),
        { status: 500 }
      );
    }

    console.info('✅ [Forgot Password] Link de recuperação gerado com sucesso');
    console.info('📧 [Forgot Password] Enviando e-mail via Resend...');

    // Enviar e-mail customizado via Resend usando EmailService
    const emailService = getEmailService();
    const emailResult = await emailService.sendPasswordResetEmail(
      user.email,
      user.fullName || user.email,
      data.properties.action_link
    );

    if (!emailResult.success) {
      console.error('❌ [Forgot Password] Erro ao enviar e-mail:', emailResult.error);
      return NextResponse.json(
        new Output(
          false, 
          [], 
          [`Erro ao enviar e-mail: ${emailResult.error}`], 
          null
        ),
        { status: 500 }
      );
    }

    console.info('✅ [Forgot Password] E-mail de recuperação enviado com sucesso');
    console.info('📬 [Forgot Password] Email ID:', emailResult.data);

    return NextResponse.json(
      new Output(
        true, 
        ['E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.'], 
        [], 
        { emailId: emailResult.data }
      ),
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ [Forgot Password] Erro inesperado:', error);
    
    return NextResponse.json(
      new Output(
        false, 
        [], 
        ['Erro inesperado ao processar solicitação'], 
        null
      ),
      { status: 500 }
    );
  }
}
