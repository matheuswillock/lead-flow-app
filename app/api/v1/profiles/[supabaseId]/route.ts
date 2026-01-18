import { NextRequest, NextResponse } from "next/server";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { validateUpdateProfileRequest } from "../DTO/requestToUpdateProfile";
import { Output } from "@/lib/output";
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/app/api/infra/data/prisma';

const profileUseCase = new RegisterNewUserProfile();

// Helper para criar cliente Supabase admin
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
 * GET /api/v1/profiles/[supabaseId]
 * Busca os dados do profile por supabaseId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.getProfileBySupabaseId(supabaseId);

    if (!result.isValid) {
      return NextResponse.json(result, { 
        status: result.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/v1/profiles/[supabaseId]:", error);
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * PUT /api/v1/profiles/[supabaseId]
 * Atualiza os dados do profile
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    
    let updateData;
    try {
      updateData = validateUpdateProfileRequest(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await profileUseCase.updateProfile(supabaseId, updateData);

    if (!result.isValid) {
      return NextResponse.json(result, { 
        status: result.errorMessages.includes("Profile not found") ? 404 : 400 
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in PUT /api/v1/profiles/[supabaseId]:", error);
    const output = new Output(false, [], ["Internal server error"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

/**
 * DELETE /api/v1/profiles/[supabaseId]
 * Deleta o profile, autenticação do Supabase e todos os dados relacionados em cascata
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string }> }
) {
  try {
    const { supabaseId } = await params;
    const body = await request.json();
    const { password } = body;

    console.info('🗑️ [DELETE Profile] Iniciando deleção de conta:', { supabaseId });

    if (!supabaseId) {
      const output = new Output(false, [], ["Supabase ID is required"], null);
      return NextResponse.json(output, { status: 400 });
    }

    if (!password) {
      return NextResponse.json(
        new Output(false, [], ['Senha é obrigatória para confirmar a exclusão'], null),
        { status: 400 }
      );
    }

    // 1. Buscar profile no Prisma
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isMaster: true,
        managerId: true
      }
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ['Usuário não encontrado'], null),
        { status: 404 }
      );
    }

    // 2. Verificar senha no Supabase Auth
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        new Output(false, [], ['Erro de configuração do servidor'], null),
        { status: 500 }
      );
    }

    // Validar senha através de sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: password
    });

    if (signInError) {
      console.error('❌ [DELETE Profile] Senha incorreta');
      return NextResponse.json(
        new Output(false, [], ['Senha incorreta'], null),
        { status: 401 }
      );
    }

    console.info('✅ [DELETE Profile] Senha validada com sucesso');

    // 3. Iniciar processo de deleção em cascata
    try {
      console.info('🔄 [DELETE Profile] Iniciando deleção em cascata...');

      // Se for manager (isMaster = true), deletar todos os operadores vinculados
      if (profile.isMaster) {
        console.info('👥 [DELETE Profile] Deletando operadores vinculados ao manager...');
        
        // Buscar operadores vinculados
        const operators = await prisma.profile.findMany({
          where: { managerId: profile.id },
          select: { id: true, supabaseId: true, email: true }
        });

        console.info(`📊 [DELETE Profile] Encontrados ${operators.length} operadores para deletar`);

        // Deletar cada operador do Supabase Auth
        for (const operator of operators) {
          try {
            await supabase.auth.admin.deleteUser(operator.supabaseId);
            console.info(`✅ [DELETE Profile] Operador ${operator.email} deletado do Supabase`);
          } catch (error) {
            console.error(`⚠️ [DELETE Profile] Erro ao deletar operador ${operator.email}:`, error);
          }
        }

        // Deletar leads do manager (cascade irá deletar attachments)
        const leadsDeleted = await prisma.lead.deleteMany({
          where: { managerId: profile.id }
        });
        console.info(`🗑️ [DELETE Profile] ${leadsDeleted.count} leads deletados`);

        // Deletar pending operators
        const pendingDeleted = await prisma.pendingOperator.deleteMany({
          where: { managerId: profile.id }
        });
        console.info(`🗑️ [DELETE Profile] ${pendingDeleted.count} pending operators deletados`);

        // Deletar operadores do Prisma (cascade irá deletar leads assignados a eles)
        const operatorsDeleted = await prisma.profile.deleteMany({
          where: { managerId: profile.id }
        });
        console.info(`🗑️ [DELETE Profile] ${operatorsDeleted.count} operadores deletados do Prisma`);
      } else {
        // Se for operador, deletar apenas seus leads assignados
        console.info('👤 [DELETE Profile] Deletando leads assignados ao operador...');
        
        const leadsDeleted = await prisma.lead.deleteMany({
          where: { assignedTo: profile.id }
        });
        console.info(`🗑️ [DELETE Profile] ${leadsDeleted.count} leads assignados deletados`);
      }

      // 4. Deletar o próprio profile do Prisma
      await prisma.profile.delete({
        where: { id: profile.id }
      });
      console.info('✅ [DELETE Profile] Profile deletado do Prisma');

      // 5. Deletar usuário do Supabase Auth
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(supabaseId);
      
      if (deleteAuthError) {
        console.error('⚠️ [DELETE Profile] Erro ao deletar do Supabase Auth:', deleteAuthError);
        // Não retornar erro pois o profile já foi deletado
      } else {
        console.info('✅ [DELETE Profile] Usuário deletado do Supabase Auth');
      }

      console.info('🎉 [DELETE Profile] Deleção completa com sucesso!');

      return NextResponse.json(
        new Output(
          true, 
          ['Conta deletada com sucesso'], 
          [], 
          { deleted: true }
        ),
        { status: 200 }
      );

    } catch (deleteError: any) {
      console.error('❌ [DELETE Profile] Erro durante deleção:', deleteError);
      return NextResponse.json(
        new Output(
          false, 
          [], 
          ['Erro ao deletar dados da conta'], 
          null
        ),
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Error in DELETE /api/v1/profiles/[supabaseId]:", error);
    const output = new Output(false, [], ["Erro inesperado ao processar solicitação"], null);
    return NextResponse.json(output, { status: 500 });
  }
}