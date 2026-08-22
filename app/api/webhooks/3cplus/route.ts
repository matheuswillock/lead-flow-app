import { NextRequest, NextResponse } from 'next/server';

import { sanitizeWebhookPayload } from '@/lib/webhooks/sanitize-webhook-payload';

export async function POST(request: NextRequest) {
  try {
    console.info('[3cplusWebhookRoute][POST] Requisicao recebida');

    const body = await request.json();

    console.info(
      '[3cplusWebhookRoute][POST] Payload:',
      JSON.stringify(sanitizeWebhookPayload(body))
    );

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
