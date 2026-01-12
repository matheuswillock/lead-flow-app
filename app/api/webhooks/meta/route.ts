import { NextRequest, NextResponse } from 'next/server';
import { metaLeadUseCase } from '@/app/api/useCases/metaLeads/MetaLeadUseCase';
import { metaLeadService } from '@/app/api/services/MetaLeadService';

/**
 * GET - Verificação do webhook (Meta envia para validar)
 * 
 * Quando você configura o webhook no Meta, ele faz uma requisição GET
 * para validar que o endpoint está ativo e responde corretamente.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Meta envia estes parâmetros na verificação
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.META_VERIFY_TOKEN || 'meta_lead_webhook_verify_token';

    console.info('🔍 Verificação do webhook Meta recebida:', {
      mode,
      token: token ? '***' : null,
      challenge: challenge ? '***' : null
    });

    // Validar token de verificação
    if (mode === 'subscribe' && token === verifyToken) {
      console.info('✅ Webhook Meta verificado com sucesso');
      
      // Retornar o challenge para confirmar
      return new NextResponse(challenge, { status: 200 });
    }

    console.error('❌ Token de verificação inválido');
    return NextResponse.json(
      { error: 'Token de verificação inválido' },
      { status: 403 }
    );

  } catch (error) {
    console.error('❌ Erro na verificação do webhook:', error);
    
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST - Recebe webhooks do Meta Lead Ads
 * 
 * Quando um lead preenche o formulário, o Meta envia um POST
 * com informações do leadgen_id para buscarmos os dados completos.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar assinatura do webhook
    const signature = request.headers.get('x-hub-signature-256') || '';
    const body = await request.text();

    console.info('📨 Webhook Meta recebido:', {
      signature: signature ? 'presente' : 'ausente',
      bodyLength: body.length
    });

    // Validar assinatura HMAC SHA256
    const isValid = metaLeadService.validateWebhookSignature(signature, body);

    if (!isValid) {
      console.error('❌ Assinatura do webhook inválida');
      
      return NextResponse.json(
        { error: 'Assinatura inválida' },
        { status: 403 }
      );
    }

    // 2. Parse do payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error('❌ Erro ao fazer parse do payload:', error);
      
      return NextResponse.json(
        { error: 'Payload inválido' },
        { status: 400 }
      );
    }

    console.info('📋 Payload recebido:', JSON.stringify(payload, null, 2));

    // 3. Extrair managerId dos query params (opcional)
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId') || undefined;

    // 4. Processar webhook via UseCase
    const result = await metaLeadUseCase.processWebhook(payload, managerId);

    // 5. Retornar resposta
    const statusCode = result.isValid ? 200 : 400;

    // Meta espera uma resposta rápida (200 OK)
    // Mesmo se houver erros, retornamos 200 para não ser bloqueado
    return NextResponse.json(
      {
        success: result.isValid,
        message: result.successMessages[0] || 'Webhook processado',
        errors: result.errorMessages,
        data: result.result
      },
      { status: 200 } // Sempre 200 para o Meta
    );

  } catch (error) {
    console.error('❌ Erro inesperado ao processar webhook:', error);

    // Retornar 200 mesmo com erro para não ser bloqueado pelo Meta
    return NextResponse.json(
      {
        success: false,
        message: 'Erro interno ao processar webhook',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 200 }
    );
  }
}

/**
 * Configurações do route handler
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
