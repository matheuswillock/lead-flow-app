import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { prisma } from '@/app/api/infra/data/prisma';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * GET /api/v1/operators/pending/[id]
 * Busca dados de um operador pendente por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.info('🔍 [GetPendingOperator] Buscando operador pendente:', id);

    // Buscar pendingOperator
    const pendingOperator = await prisma.pendingOperator.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            supabaseId: true,
            fullName: true,
            email: true,
          }
        }
      }
    });

    if (!pendingOperator) {
      console.warn('⚠️ [GetPendingOperator] Operador pendente não encontrado:', id);
      return NextResponse.json(
        new Output(false, [], ['Operador não encontrado'], null),
        { status: 404 }
      );
    }

    console.info('✅ [GetPendingOperator] Operador encontrado:', {
      id: pendingOperator.id,
      name: pendingOperator.name,
      paymentStatus: pendingOperator.paymentStatus,
      operatorCreated: pendingOperator.operatorCreated,
    });

    // Retornar dados formatados
    const result = {
      id: pendingOperator.id,
      name: pendingOperator.name,
      email: pendingOperator.email,
      role: pendingOperator.role,
      paymentId: pendingOperator.paymentId,
      paymentStatus: pendingOperator.paymentStatus,
      paymentMethod: pendingOperator.paymentMethod,
      operatorCreated: pendingOperator.operatorCreated,
      operatorId: pendingOperator.operatorId,
      managerId: pendingOperator.manager?.supabaseId || '',
      createdAt: pendingOperator.createdAt,
      updatedAt: pendingOperator.updatedAt,
    };

    return NextResponse.json(
      new Output(true, ['Dados do operador carregados'], [], result),
      { status: 200 }
    );

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ [GetPendingOperator] Erro:', error);
    
    return NextResponse.json(
      new Output(false, [], ['Erro ao buscar dados do operador'], null),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/operators/pending/[id]
 * Deleta um operador pendente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.info('🗑️ [DeletePendingOperator] Deletando operador pendente:', id);

    const pendingOperator = await prisma.pendingOperator.findUnique({ where: { id } });

    if (pendingOperator) {
      await prisma.pendingOperator.delete({ where: { id } });
      console.info('✅ [DeletePendingOperator] PendingOperator deletado com sucesso:', id);
      return NextResponse.json(
        new Output(true, ['Operador pendente deletado com sucesso'], [], null),
        { status: 200 }
      );
    }

    const pendingAction = await prisma.pendingAction.findUnique({ where: { id } });

    if (!pendingAction) {
      console.warn('⚠️ [DeletePendingOperator] Registro não encontrado em nenhuma tabela:', id);
      return NextResponse.json(
        new Output(false, [], ['Operador pendente não encontrado'], null),
        { status: 404 }
      );
    }

    await prisma.pendingAction.delete({ where: { id } });
    console.info('✅ [DeletePendingOperator] PendingAction deletado com sucesso:', id);

    return NextResponse.json(
      new Output(true, ['Operador pendente deletado com sucesso'], [], null),
      { status: 200 }
    );

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ [DeletePendingOperator] Erro ao deletar:', error);
    
    return NextResponse.json(
      new Output(false, [], ['Erro ao deletar operador pendente'], null),
      { status: 500 }
    );
  }
}
