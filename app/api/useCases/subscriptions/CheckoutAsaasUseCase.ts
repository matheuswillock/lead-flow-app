import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasFetch, asaasApi } from "@/lib/asaas";
import { getEmailService } from "@/lib/services/EmailService";
import { createClient } from "@supabase/supabase-js";
import { getFullUrl } from "@/lib/utils/app-url";

// Helper para detectar ambiente de produção
function getIsProduction() {
  const asaasEnv = process.env.ASAAS_ENV;
  if (asaasEnv) {
    return asaasEnv === 'production';
  }
  return process.env.NODE_ENV === 'production';
}

// Função para criar cliente Supabase admin
function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[Supabase Admin] Credenciais não configuradas');
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export interface CreateCheckoutData {
  supabaseId: string;
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  complement?: string;
  city?: string;
  state?: string;
}

export interface ICheckoutAsaasUseCase {
  createSubscriptionCheckout(data: CreateCheckoutData): Promise<Output>;
  processCheckoutPaid(checkoutId: string): Promise<Output>;
}

export class CheckoutAsaasUseCase implements ICheckoutAsaasUseCase {
  
  /**
   * Cria link de pagamento (checkout) no Asaas para assinatura
   * Retorna URL para redirecionar o cliente
   */
  async createSubscriptionCheckout(data: CreateCheckoutData): Promise<Output> {
    let asaasCustomerId: string | null = null;
    let customerWasCreated = false;
    let isFirstCheckoutAttempt = false;
    let profileId: string | null = null;

    try {
      console.info('🛒 [createSubscriptionCheckout] Iniciando criação de checkout:', {
        supabaseId: data.supabaseId,
        email: data.email
      });

      // 1. Buscar ou criar cliente Asaas
      const profile = await prisma.profile.findUnique({
        where: { supabaseId: data.supabaseId }
      });

      if (!profile) {
        return new Output(false, [], ['Usuário não encontrado'], null);
      }

      profileId = profile.id;
      
      // Verificar se é a primeira tentativa de checkout (processo de registro)
      // Se não tem asaasCustomerId e não tem subscriptionId, é a primeira vez
      isFirstCheckoutAttempt = !profile.asaasCustomerId && !profile.subscriptionId;
      
      if (isFirstCheckoutAttempt) {
        console.info('🆕 [createSubscriptionCheckout] Primeira tentativa de checkout - rollback ativo');
      }

      asaasCustomerId = profile.asaasCustomerId;

      // Criar cliente no Asaas se não existir
      if (!asaasCustomerId) {
        console.info('👤 [createSubscriptionCheckout] Criando cliente no Asaas...');
        
        // Usar dados do Profile (recém-criado) ou fallback dos dados do request
        const customerData: any = {
          name: profile.fullName || data.fullName,
          email: profile.email || data.email,
          mobilePhone: (profile.phone || data.phone)?.replace(/\D/g, '') || undefined,
          cpfCnpj: (profile.cpfCnpj || data.cpfCnpj)?.replace(/\D/g, '') || undefined,
          postalCode: (profile.postalCode || data.postalCode)?.replace(/\D/g, '') || '01310100',
          address: profile.address || data.address || 'Não informado',
          addressNumber: profile.addressNumber || data.addressNumber || 'S/N',
          province: profile.neighborhood || data.neighborhood || 'Centro', // Province = Bairro
        };

        // Adicionar complemento se fornecido
        if (profile.complement || data.complement) {
          customerData.complement = profile.complement || data.complement;
        }

        console.info('📍 [createSubscriptionCheckout] Dados do cliente:', {
          name: customerData.name,
          email: customerData.email,
          postalCode: customerData.postalCode,
          address: customerData.address,
          addressNumber: customerData.addressNumber,
          province: customerData.province,
          complement: customerData.complement,
          dataSource: profile.neighborhood ? 'profile' : 'request',
        });

        try {
          const customer = await asaasFetch(asaasApi.customers, {
            method: 'POST',
            body: JSON.stringify(customerData),
          });

          asaasCustomerId = customer.id;
          customerWasCreated = true;

          // Salvar customer ID no profile
          await prisma.profile.update({
            where: { supabaseId: data.supabaseId },
            data: { asaasCustomerId }
          });

          console.info('✅ [createSubscriptionCheckout] Cliente Asaas criado:', asaasCustomerId);
        } catch (customerError: any) {
          console.error('❌ [createSubscriptionCheckout] Erro ao criar cliente Asaas:', customerError);
          return new Output(
            false, 
            [], 
            [`Erro ao criar cliente no sistema de pagamentos: ${customerError.message}`], 
            null
          );
        }
      }

      // 2. Criar Asaas Checkout com assinatura recorrente
      // nextDueDate = data da PRIMEIRA cobrança (hoje, para cobrar no ato)
      // A segunda cobrança será automaticamente agendada para +1 mês (MONTHLY)
      const now = new Date();
      const nextDueDateStr = now.toISOString().slice(0, 19).replace('T', ' '); // "2026-01-18 12:00:00"
      
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' '); // "2027-01-18 12:00:00"

      console.info('📝 [createSubscriptionCheckout] Criando Asaas Checkout...');
      console.info('📅 [createSubscriptionCheckout] Datas da assinatura:', {
        firstPayment: nextDueDateStr,
        endDate: endDateStr,
        cycle: 'MONTHLY - próxima cobrança em +30 dias'
      });

      const checkoutData: any = {
        customer: asaasCustomerId,
        billingTypes: ['CREDIT_CARD'], // Habilita todas as opções no checkout
        chargeTypes: ['RECURRENT'], // ✅ Assinatura recorrente
        subscription: {
          cycle: 'MONTHLY',
          nextDueDate: nextDueDateStr,
          endDate: endDateStr,
        },
        items: [
          {
            name: 'Plano Professional',
            description: 'Sistema completo de gestão de leads com pipeline Kanban, analytics em tempo real e gestão de equipe.',
            value: 59.90,
            quantity: 1,
          }
        ],
        callback: {
          successUrl: getFullUrl('/checkout-return'),
          cancelUrl: getFullUrl(`/sign-up?deleteUser=${data.supabaseId}`),
          expiredUrl: getFullUrl(`/sign-up?deleteUser=${data.supabaseId}`),
          autoRedirect: true,
        },
      };

      const checkout = await asaasFetch(asaasApi.checkouts, {
        method: 'POST',
        body: JSON.stringify(checkoutData),
      });

      console.info('✅ [createSubscriptionCheckout] Checkout criado:', checkout.id);

      // 3. Construir URL do checkout
      const checkoutUrl = `https://${getIsProduction() ? 'www' : 'sandbox'}.asaas.com/checkoutSession/show?id=${checkout.id}`;
      console.info('🔗 [createSubscriptionCheckout] Checkout URL:', checkoutUrl);

      // 3. Salvar informações no profile
      await prisma.profile.update({
        where: { supabaseId: data.supabaseId },
        data: {
          subscriptionStatus: 'trial',
          subscriptionPlan: 'manager_base',
        }
      });

      console.info('🎉 [createSubscriptionCheckout] Checkout criado com sucesso!');

      return new Output(
        true,
        ['Checkout criado com sucesso'],
        [],
        {
          checkoutUrl,
          checkoutId: checkout.id,
        }
      );

    } catch (error: any) {
      console.error('❌ [createSubscriptionCheckout] Erro:', error);

      // Traduzir mensagens de erro comuns do Asaas
      let errorMessage = error.message || 'Erro desconhecido';
      
      if (errorMessage.includes('domínio')) {
        errorMessage = 'Configure um domínio na sua conta Asaas para criar checkouts. Acesse: Minha Conta → Informações';
      }

      // ROLLBACK COMPLETO: Se é a primeira tentativa de checkout, deletar o usuário
      if (isFirstCheckoutAttempt && data.supabaseId) {
        console.warn('⚠️ [createSubscriptionCheckout] Primeira tentativa falhou - iniciando rollback completo do usuário');
        
        try {
          // 1. Deletar profile do banco de dados
          if (profileId) {
            console.info('🗑️ [createSubscriptionCheckout] Rollback: Deletando profile do banco...');
            await prisma.profile.delete({
              where: { id: profileId }
            });
            console.info('✅ [createSubscriptionCheckout] Profile deletado');
          }

          // 2. Deletar usuário do Supabase Auth
          const supabaseAdmin = createSupabaseAdminClient();
          if (supabaseAdmin) {
            console.info('🗑️ [createSubscriptionCheckout] Rollback: Deletando usuário do Supabase Auth...');
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
              data.supabaseId
            );
            
            if (deleteError) {
              console.error('❌ [createSubscriptionCheckout] Erro ao deletar usuário do Auth:', deleteError);
            } else {
              console.info('✅ [createSubscriptionCheckout] Usuário deletado do Auth');
            }
          }

          console.info('✅ [createSubscriptionCheckout] Rollback completo concluído');
          
          return new Output(
            false,
            [],
            [
              'Erro no processo de registro. Por favor, tente criar sua conta novamente.',
              `Detalhes: ${errorMessage}`
            ],
            null
          );
          
        } catch (rollbackError: any) {
          console.error('❌ [createSubscriptionCheckout] Erro crítico no rollback:', rollbackError);
          
          return new Output(
            false,
            [],
            [
              'Erro crítico no processo de registro.',
              'Entre em contato com o suporte informando este erro.',
              `Detalhes: ${errorMessage}`
            ],
            null
          );
        }
      }

      // Rollback parcial: Se não é primeira tentativa, apenas limpar asaasCustomerId
      if (customerWasCreated && asaasCustomerId) {
        try {
          console.warn('🔄 [createSubscriptionCheckout] Rollback parcial: Removendo asaasCustomerId...');
          await prisma.profile.update({
            where: { supabaseId: data.supabaseId },
            data: { asaasCustomerId: null }
          });
          console.info('✅ [createSubscriptionCheckout] Rollback parcial concluído');
        } catch (rollbackError) {
          console.error('❌ [createSubscriptionCheckout] Erro no rollback parcial:', rollbackError);
        }
      }
      
      return new Output(
        false,
        [],
        [`Erro ao criar checkout: ${errorMessage}`],
        null
      );
    }
  }

  /**
   * Processa webhook quando checkout é pago
   * Ativa a conta do usuário
   */
  async processCheckoutPaid(checkoutId: string): Promise<Output> {
    try {
      console.info('💰 [processCheckoutPaid] Processando pagamento de checkout:', checkoutId);

      // Buscar cobrança no Asaas para obter subscription
      const payment = await asaasFetch(
        `${asaasApi.payments}/${checkoutId}`,
        { method: 'GET' }
      );

      if (!payment.subscription) {
        return new Output(
          false,
          [],
          ['Cobrança não está vinculada a uma assinatura'],
          null
        );
      }

      // Buscar profile pela assinatura
      const profile = await prisma.profile.findFirst({
        where: { asaasSubscriptionId: payment.subscription }
      });

      if (!profile) {
        return new Output(
          false,
          [],
          ['Usuário não encontrado para esta assinatura'],
          null
        );
      }

      // Atualizar status da assinatura para ativa
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'active',
          subscriptionStartDate: new Date(),
        }
      });

      console.info('✅ [processCheckoutPaid] Assinatura ativada para:', profile.email);

      // Enviar e-mail de boas-vindas
      try {
        const emailService = getEmailService();
        const loginUrl = getFullUrl('/sign-in');

        await emailService.sendWelcomeEmail({
          userName: profile.fullName || profile.email,
          userEmail: profile.email,
          loginUrl,
        });

        console.info('✅ [processCheckoutPaid] E-mail de boas-vindas enviado para:', profile.email);
      } catch (emailError) {
        console.error('⚠️ [processCheckoutPaid] Erro ao enviar e-mail de boas-vindas:', emailError);
        // Não bloqueia o fluxo principal
      }

      return new Output(
        true,
        ['Assinatura ativada com sucesso'],
        [],
        { supabaseId: profile.supabaseId }
      );

    } catch (error: any) {
      console.error('❌ [processCheckoutPaid] Erro:', error);
      
      return new Output(
        false,
        [],
        ['Erro ao processar pagamento'],
        null
      );
    }
  }
}

export const checkoutAsaasUseCase = new CheckoutAsaasUseCase();
