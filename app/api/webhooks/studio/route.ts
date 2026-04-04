import { NextResponse } from "next/server";


export async function POST(request: NextResponse)  {
  try {
    console.info('[StudioWebhookRoute][POST] ============================================');
    console.info('[StudioWebhookRoute][POST] Requisicao recebida');
    console.info('[StudioWebhookRoute][POST] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
    
    const body = await request.json();

    console.info('[StudioWebhookRoute][POST] Body completo:', JSON.stringify(body, null, 2));
    console.info('[StudioWebhookRoute][POST] ============================================');
  
  } catch (error: unknown) {
    console.error('Erro ao processar webhook do Corretor Studio:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao processar webhook' },
      { status: 200 }
    );
  }
}