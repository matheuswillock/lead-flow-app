import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/infra/data/prisma';
import { Output } from '@/lib/output';
import { asaasApi, asaasFetch } from '@/lib/asaas';

/**
 * GET /api/v1/operators/pending/[id]/status
 * Endpoint de debug para verificar status detalhado de um operador pendente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.info('🔍 [Debug Status] Buscando PendingOperator:', id);

    // Buscar operador pendente
    const pendingOperator = await prisma.pendingOperator.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            supabaseId: true,
            fullName: true,
            email: true,
          }
        }
      }
    });

    if (!pendingOperator) {
      return NextResponse.json(
        new Output(false, [], ['PendingOperator não encontrado'], null),
        { status: 404 }
      );
    }

    // Verificar se já existe um Profile criado
    let existingProfile = null;
    if (pendingOperator.operatorId) {
      existingProfile = await prisma.profile.findUnique({
        where: { id: pendingOperator.operatorId }
      });
    }

    // Verificar status no Asaas (se tiver paymentId)
    let asaasStatus = null;
    if (pendingOperator.paymentId) {
      try {
        const payment = await asaasFetch(
          `${asaasApi.payments}/${pendingOperator.paymentId}`,
          { method: 'GET' }
        );

        asaasStatus = {
          id: payment.id,
          status: payment.status,
          value: payment.value,
          billingType: payment.billingType,
          externalReference: payment.externalReference,
          confirmedDate: payment.confirmedDate,
        };
      } catch (error) {
        console.error('Erro ao verificar status no Asaas:', error);
      }
    }

    const debugInfo = {
      pendingOperator: {
        id: pendingOperator.id,
        name: pendingOperator.name,
        email: pendingOperator.email,
        role: pendingOperator.role,
        paymentId: pendingOperator.paymentId,
        paymentStatus: pendingOperator.paymentStatus,
        paymentMethod: pendingOperator.paymentMethod,
        operatorCreated: pendingOperator.operatorCreated,
        operatorId: pendingOperator.operatorId,
        subscriptionId: pendingOperator.subscriptionId,
        createdAt: pendingOperator.createdAt,
        updatedAt: pendingOperator.updatedAt,
      },
      manager: pendingOperator.manager,
      existingProfile: existingProfile ? {
        id: existingProfile.id,
        supabaseId: existingProfile.supabaseId,
        fullName: existingProfile.fullName,
        email: existingProfile.email,
        role: existingProfile.role,
      } : null,
      asaasStatus,
      canCreateOperator: !pendingOperator.operatorCreated && 
                        pendingOperator.paymentStatus === 'CONFIRMED',
      blockers: [] as string[]
    };

    // Verificar blockers
    if (pendingOperator.operatorCreated) {
      debugInfo.blockers.push('Operador já foi criado');
    }
    
    if (pendingOperator.paymentStatus !== 'CONFIRMED') {
      debugInfo.blockers.push(`Pagamento não confirmado (status: ${pendingOperator.paymentStatus})`);
    }

    if (!pendingOperator.paymentId) {
      debugInfo.blockers.push('PaymentId não definido');
    }

    return NextResponse.json(
      new Output(true, ['Status recuperado'], [], debugInfo),
      { status: 200 }
    );

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro interno do servidor'], null),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/operators/pending/[id]/status
 * Força tentativa de criação do operador (para debug)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.info('🔄 [Debug Force Create] Forçando criação para PendingOperator:', id);

    // Buscar operador pendente
    const pendingOperator = await prisma.pendingOperator.findUnique({
      where: { id },
    });

    if (!pendingOperator) {
      return NextResponse.json(
        new Output(false, [], ['PendingOperator não encontrado'], null),
        { status: 404 }
      );
    }

    if (pendingOperator.operatorCreated) {
      return NextResponse.json(
        new Output(false, [], ['Operador já foi criado'], null),
        { status: 400 }
      );
    }

    if (!pendingOperator.paymentId) {
      return NextResponse.json(
        new Output(false, [], ['PaymentId não definido'], null),
        { status: 400 }
      );
    }

    // Importar UseCase
    const { subscriptionUpgradeUseCase } = await import('@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase');

    // Tentar criar operador
    const result = await subscriptionUpgradeUseCase.confirmPaymentAndCreateOperator(
      pendingOperator.paymentId
    );

    const statusCode = result.isValid ? 200 : 400;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro ao forçar criação:', error);
    return NextResponse.json(
      new Output(false, [], ['Erro interno do servidor'], null),
      { status: 500 }
    );
  }
}
