import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from '@/lib/output';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { getPaymentByAccountWithFallback } from '@/lib/billing/get-payment-by-account';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  await connection();

  try {
    const { paymentId } = await params;

    if (!paymentId) {
      const error = new Output(false, [], ['paymentId é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    // Buscar status do pagamento no Asaas — C24/m9 de
    // [[20 — Assinaturas — Backend]] E5: a URL relativa antiga
    // (`asaasFetch('/payments/...')`) sempre falhava em Node (sem origem
    // implícita) — todo poll dessa rota (usada por
    // ReactivateSubscriptionDialog.tsx) 500ava. Sem contexto de perfil aqui
    // (só paymentId), usa o helper com fallback primary→legacy (C24).
    const result_ = await getPaymentByAccountWithFallback(paymentId);

    if (!result_.found) {
      const error = new Output(false, [], ['Pagamento não encontrado'], null);
      return NextResponse.json(error, { status: 404 });
    }

    const payment = result_.payment as {
      id: string;
      status?: string;
      value?: number;
      dueDate?: string;
      paymentDate?: string;
      billingType?: string;
    };

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
    rethrowIfPrerenderInterrupted(error);
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
