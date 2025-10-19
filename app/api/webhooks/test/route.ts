// app/api/webhooks/test/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint simples para testar se webhooks estão chegando
 * Teste com: curl -X POST https://seu-ngrok.ngrok-free.dev/api/webhooks/test
 */
export async function GET(_request: NextRequest) {
  console.info('✅ [Webhook Test] GET recebido!');
  
  return NextResponse.json({
    success: true,
    message: 'Webhook test endpoint is working!',
    timestamp: new Date().toISOString(),
    method: 'GET'
  });
}

export async function POST(request: NextRequest) {
  console.info('✅ [Webhook Test] POST recebido!');
  
  try {
    const body = await request.json();
    console.info('📦 [Webhook Test] Body:', body);

    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully!',
      timestamp: new Date().toISOString(),
      method: 'POST',
      receivedData: body
    });
  } catch (error) {
    console.error('❌ [Webhook Test] Erro:', error);
    return NextResponse.json({
      success: false,
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
