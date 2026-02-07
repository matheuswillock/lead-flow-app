import { NextRequest, NextResponse } from 'next/server';
import { metaLeadUseCase } from '@/app/api/useCases/metaLeads/MetaLeadUseCase';
import { metaLeadService } from '@/app/api/services/MetaLeadService';
import { metaLeadIntegrationRepository } from '@/app/api/infra/data/repositories/integrations/MetaLeadIntegrationRepository';
import { decryptToken } from '@/lib/integrations-crypto';

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

    console.info('🔍 Verificação do webhook Meta recebida:', {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge
    });

    if (mode === 'subscribe' && token) {
      const integration = await metaLeadIntegrationRepository.findByVerifyToken(token);

      if (integration) {
        console.info('✅ Webhook Meta verificado com sucesso');
        return new NextResponse(challenge, { status: 200 });
      }
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

    const pageId =
      payload?.entry?.[0]?.changes?.[0]?.value?.page_id ||
      payload?.entry?.[0]?.id;

    if (!pageId) {
      console.warn('⚠️ Page ID não encontrado no payload');
      return NextResponse.json(
        { success: false, message: 'Page ID não encontrado no payload' },
        { status: 200 }
      );
    }

    const integration = await metaLeadIntegrationRepository.findByPageId(pageId);
    if (!integration || !integration.isActive) {
      console.warn('⚠️ Integração Meta não encontrada ou inativa para pageId:', pageId);
      return NextResponse.json(
        { success: false, message: 'Integração Meta não encontrada ou inativa' },
        { status: 200 }
      );
    }

    const accessToken = decryptToken(integration.pageAccessTokenEnc);

    // 4. Processar webhook via UseCase
    const result = await metaLeadUseCase.processWebhook(payload, {
      managerId: integration.managerId,
      teamId: integration.teamId,
      pageAccessToken: accessToken,
      defaultAssigneeId: integration.defaultAssigneeId,
      metaPageId: pageId
    });

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
