import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/infra/data/prisma';
import { createClient } from '@supabase/supabase-js';
import { Output } from '@/lib/output';

/**
 * Cria cliente Supabase admin para operações privilegiadas
 */
function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[Supabase Admin] Credenciais não configuradas');
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * DELETE /api/v1/users/delete?supabaseId={id}
 * Deleta usuário do Supabase Auth e Profile do Prisma
 * Usado quando checkout é cancelado/expirado
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supabaseId = searchParams.get('supabaseId');

    console.info('🗑️ [DELETE /api/v1/users/delete] Requisição recebida:', { supabaseId });

    // Validação
    if (!supabaseId) {
      const error = new Output(false, [], ['supabaseId é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    // Verificar se usuário existe
    const profile = await prisma.profile.findUnique({
      where: { supabaseId }
    });

    if (!profile) {
      console.warn('⚠️ [DELETE /api/v1/users/delete] Profile não encontrado:', supabaseId);
      // Retornar sucesso mesmo assim (idempotência)
      return NextResponse.json(
        new Output(true, ['Usuário já foi removido'], [], null),
        { status: 200 }
      );
    }

    // 1. Deletar profile do Prisma
    try {
      await prisma.profile.delete({
        where: { supabaseId }
      });
      console.info('✅ [DELETE /api/v1/users/delete] Profile deletado do Prisma');
    } catch (prismaError: any) {
      console.error('❌ [DELETE /api/v1/users/delete] Erro ao deletar profile:', prismaError);
      
      // Se profile não existe, continuar com Supabase
      if (!prismaError.code || prismaError.code !== 'P2025') {
        return NextResponse.json(
          new Output(false, [], ['Erro ao deletar profile do banco de dados'], null),
          { status: 500 }
        );
      }
    }

    // 2. Deletar usuário do Supabase Auth
    const supabaseAdmin = createSupabaseAdminClient();
    
    if (!supabaseAdmin) {
      console.error('❌ [DELETE /api/v1/users/delete] Cliente Supabase Admin não disponível');
      return NextResponse.json(
        new Output(false, [], ['Erro ao configurar cliente de autenticação'], null),
        { status: 500 }
      );
    }

    try {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(supabaseId);

      if (deleteError) {
        console.error('❌ [DELETE /api/v1/users/delete] Erro Supabase:', deleteError);
        return NextResponse.json(
          new Output(false, [], ['Erro ao deletar usuário da autenticação'], null),
          { status: 500 }
        );
      }

      console.info('✅ [DELETE /api/v1/users/delete] Usuário deletado do Supabase Auth');
    } catch (supabaseError: any) {
      console.error('❌ [DELETE /api/v1/users/delete] Erro ao deletar do Supabase:', supabaseError);
      
      // Se usuário já foi deletado no Supabase, considerar sucesso
      if (supabaseError.status === 404) {
        console.warn('⚠️ [DELETE /api/v1/users/delete] Usuário já foi removido do Supabase');
      } else {
        return NextResponse.json(
          new Output(false, [], ['Erro ao deletar usuário da autenticação'], null),
          { status: 500 }
        );
      }
    }

    console.info('🎉 [DELETE /api/v1/users/delete] Usuário deletado com sucesso');

    return NextResponse.json(
      new Output(true, ['Usuário deletado com sucesso'], [], null),
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ [DELETE /api/v1/users/delete] Erro inesperado:', error);

    return NextResponse.json(
      new Output(false, [], ['Erro interno do servidor'], null),
      { status: 500 }
    );
  }
}
