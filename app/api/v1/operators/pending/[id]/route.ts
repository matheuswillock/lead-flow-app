import { NextRequest, NextResponse } from 'next/server';
import { Output } from '@/lib/output';
import { prisma } from '@/app/api/infra/data/prisma';

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
    console.error('❌ [GetPendingOperator] Erro:', error);
    
    return NextResponse.json(
      new Output(false, [], ['Erro ao buscar dados do operador'], null),
      { status: 500 }
    );
  }
}
