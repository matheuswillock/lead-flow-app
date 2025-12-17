import { NextRequest, NextResponse } from 'next/server';
import { asaasFetch } from '@/lib/asaas';
import { Output } from '@/lib/output';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;

    if (!paymentId) {
      const error = new Output(false, [], ['paymentId é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    // Buscar status do pagamento no Asaas
    const payment = await asaasFetch(`/payments/${paymentId}`);

    if (!payment || !payment.id) {
      const error = new Output(false, [], ['Pagamento não encontrado'], null);
      return NextResponse.json(error, { status: 404 });
    }

    const result = new Output(
      true,
      ['Status do pagamento obtido com sucesso'],
      [],
      {
        paymentId: payment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        billingType: payment.billingType
      }
    );

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    
    const errorResult = new Output(
      false,
      [],
      ['Erro ao verificar status do pagamento'],
      null
    );

    return NextResponse.json(errorResult, { status: 500 });
  }
}
