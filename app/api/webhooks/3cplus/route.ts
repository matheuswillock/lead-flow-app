import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.info('[3cplusWebhookRoute][POST] ============================================');
    console.info('[3cplusWebhookRoute][POST] Requisicao recebida');
    console.info('[3cplusWebhookRoute][POST] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));

    const body = await request.json();

    console.info('[3cplusWebhookRoute][POST] Body completo:', JSON.stringify(body, null, 2));
    console.info('[3cplusWebhookRoute][POST] ============================================');

    return NextResponse.json(
      { success: true, message: 'Webhook recebido' },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('[3cplusWebhookRoute][POST] Erro:', error);

    return NextResponse.json(
      { success: false, message: 'Erro ao processar webhook' },
      { status: 200 }
    );
  }
}
