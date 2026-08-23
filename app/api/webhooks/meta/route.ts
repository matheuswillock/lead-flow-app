import { NextRequest, NextResponse, connection } from "next/server";
import { metaLeadUseCase } from '@/app/api/useCases/metaLeads/MetaLeadUseCase';
import { invalidateLeadCache } from '@/lib/cache/invalidation';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * Invalida o cache de cada lead criado ou tocado pelo webhook.
 *
 * `processWebhook` devolve um array com um item por `leadgen_id` processado.
 * Itens sem `teamId` sao ignorados em silencio: significam falha de
 * processamento, ja reportada em `errorMessages`.
 */
function invalidateLeadCacheForCreatedLeads(result: unknown): void {
  if (!Array.isArray(result)) return;

  for (const item of result) {
    if (!item || typeof item !== 'object') continue;

    const { id, teamId } = item as { id?: unknown; teamId?: unknown };
    if (typeof id !== 'string' || typeof teamId !== 'string') continue;

    invalidateLeadCache({ leadId: id, teamId });
  }
}

/**
 * GET - Verificação do webhook (Meta envia para validar)
 * 
 * Quando você configura o webhook no Meta, ele faz uma requisição GET
 * para validar que o endpoint está ativo e responde corretamente.
 */
export async function GET(request: NextRequest) {
  await connection();

  try {
    const { searchParams } = new URL(request.url);

    // Meta envia estes parâmetros na verificação
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.META_VERIFY_TOKEN;

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
    rethrowIfPrerenderInterrupted(error);
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
    const isValid = metaLeadUseCase.validateWebhookSignature(signature, body);

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
    rethrowIfPrerenderInterrupted(error);
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

    // 5. Invalidar o cache dos times que receberam lead.
    //
    // Sem isto o lead entra no banco mas nao aparece no board ate o TTL do
    // cache expirar (60s) — os demais caminhos de criacao de lead ja invalidam,
    // este era o unico que nao invalidava.
    invalidateLeadCacheForCreatedLeads(result.result);

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
    rethrowIfPrerenderInterrupted(error);
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

