// app/api/v1/subscriptions/[subscriptionId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/infra/data/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    // Aguardar params (Next.js 15)
    const { subscriptionId } = await params;

    console.info('🔍 [StatusController] Verificando status:', subscriptionId);

    // Buscar profile pela subscriptionId
    const profile = await prisma.profile.findFirst({
      where: {
        subscriptionId: subscriptionId,
      },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
      },
    });

    if (!profile) {
      console.warn('⚠️ [StatusController] Profile não encontrado - assumindo pagamento pendente');
      
      // Quando o profile não existe, significa que o pagamento foi confirmado mas o usuário ainda não fez o sign-up
      // Retornar isPaid: true para que o polling redirecione para o sign-up
      return NextResponse.json({
        isPaid: true, // ✅ Consideramos pago pois o webhook já confirmou
        status: 'paid_pending_signup',
        message: 'Pagamento confirmado - complete seu cadastro',
      });
    }

    const isPaid = profile.subscriptionStatus === 'active';

    console.info('📊 [StatusController] Status:', {
      profileId: profile.id,
      isPaid,
      subscriptionStatus: profile.subscriptionStatus,
    });

    return NextResponse.json({
      isPaid,
      status: profile.subscriptionStatus || 'pending',
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionPlan: profile.subscriptionPlan,
      subscriptionStartDate: profile.subscriptionStartDate,
      subscriptionEndDate: profile.subscriptionEndDate,
    });
  } catch (error: any) {
    console.error('❌ [StatusController] Erro:', error);
    return NextResponse.json(
      {
        isPaid: false,
        status: 'error',
        message: error.message || 'Erro ao verificar status',
      },
      { status: 500 }
    );
  }
}
