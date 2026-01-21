import { NextRequest, NextResponse } from 'next/server'
import { CreateSubscriptionUseCase } from '@/app/api/useCases/subscriptions/CreateSubscriptionUseCase'
import { Output } from '@/lib/output'

// Controller enxuto conforme SOLID / Clean Architecture
// Orquestra apenas (HTTP -> UseCase -> HTTP) sem acessar diretamente services/infra
export async function POST(req: NextRequest) {
  console.info('🌐 [SubscriptionController] Requisição recebida');
  
  try {
    const body = await req.json()
    const supabaseId = req.headers.get('x-supabase-user-id') || undefined
    console.info('🌐 [SubscriptionController] Body:', { 
      email: body.email, 
      billingType: body.billingType,
      fullName: body.fullName,
      hasSupabaseId: !!supabaseId
    });

    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const remoteIp = forwardedFor.split(',')[0]?.trim() || undefined
    const useCase = new CreateSubscriptionUseCase()
    const output: Output = await useCase.execute({
      supabaseId,
      fullName: body.fullName,
      email: body.email,
      cpfCnpj: body.cpfCnpj,
      phone: body.phone,
      postalCode: body.postalCode,
      address: body.address,
      addressNumber: body.addressNumber,
      complement: body.complement,
      province: body.province,
      city: body.city,
      state: body.state,
      billingType: body.billingType || 'CREDIT_CARD',
      creditCard: body.creditCard,
      remoteIp
    })

    console.info('🌐 [SubscriptionController] Output:', { 
      isValid: output.isValid, 
      errorMessages: output.errorMessages,
      hasResult: !!output.result,
      hasPix: !!(output.result as any)?.pix,
      hasPaymentId: !!(output.result as any)?.paymentId,
      resultKeys: output.result ? Object.keys(output.result) : []
    });

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error: any) {
    console.error('❌ [SubscriptionController] Erro:', error)
    return NextResponse.json(new Output(false, [], [error.message || 'Internal server error'], null), { status: 500 })
  }
}
