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

export interface CreateOperatorCheckoutData {
  managerId: string;
  operatorData: {
    name: string;
    email: string;
    role: string;
  };
}

export interface ICheckoutAsaasUseCase {
  createSubscriptionCheckout(data: CreateCheckoutData): Promise<Output>;
  createOperatorCheckout(data: CreateOperatorCheckoutData): Promise<Output>;
  processCheckoutPaid(checkoutId: string): Promise<Output>;
  processOperatorCheckoutPaid(checkoutSessionId: string, paymentId: string): Promise<Output>;
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
   * Cria checkout para adicionar operador à assinatura existente do manager
   * Incrementa o valor da assinatura em +R$ 19,90
   */
  async createOperatorCheckout(data: CreateOperatorCheckoutData): Promise<Output> {
    let pendingOperatorId: string | null = null;

    try {
      console.info('🛒 [createOperatorCheckout] Iniciando criação de checkout para operador:', {
        managerId: data.managerId,
        operatorEmail: data.operatorData.email
      });

      // 1. Buscar manager e validar
      const manager = await prisma.profile.findUnique({
        where: { supabaseId: data.managerId }
      });

      if (!manager) {
        return new Output(false, [], ['Manager não encontrado'], null);
      }

      if (manager.role !== 'manager') {
        return new Output(false, [], ['Apenas managers podem adicionar operadores'], null);
      }

      if (!manager.subscriptionStatus || manager.subscriptionStatus === 'canceled') {
        return new Output(false, [], ['Manager não possui assinatura ativa'], null);
      }

      if (!manager.asaasCustomerId) {
        return new Output(false, [], ['Manager não possui customer Asaas configurado'], null);
      }

      if (!manager.asaasSubscriptionId) {
        return new Output(false, [], ['Manager não possui assinatura Asaas configurada'], null);
      }

      // 2. Verificar se email do operador já existe
      const existingUser = await prisma.profile.findFirst({
        where: { email: data.operatorData.email }
      });

      if (existingUser) {
        return new Output(false, [], ['Email já está em uso'], null);
      }

      // 3. Criar pendingOperator no banco
      const pendingOperator = await prisma.pendingOperator.create({
        data: {
          managerId: manager.id,
          name: data.operatorData.name,
          email: data.operatorData.email,
          role: data.operatorData.role,
          paymentId: 'pending',
          subscriptionId: manager.asaasSubscriptionId,
          paymentStatus: 'PENDING',
          paymentMethod: 'UNDEFINED',
        }
      });

      pendingOperatorId = pendingOperator.id;
      console.info('💾 [createOperatorCheckout] PendingOperator criado:', pendingOperatorId);

      // 4. Criar Asaas Checkout para licença adicional
      // Usar checkout hospedado do Asaas (permite escolher forma de pagamento)
      const now = new Date();
      const nextDueDateStr = now.toISOString().slice(0, 19).replace('T', ' ');
      
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      const endDateStr = endDate.toISOString().slice(0, 19).replace('T', ' ');

      console.info('📝 [createOperatorCheckout] Criando Asaas Checkout...');
      console.info('📅 [createOperatorCheckout] Datas:', {
        firstPayment: nextDueDateStr,
        endDate: endDateStr,
      });

      const checkoutData: any = {
        customer: manager.asaasCustomerId,
        billingTypes: ['CREDIT_CARD'], // Apenas cartão para assinatura recorrente
        chargeTypes: ['RECURRENT'],
        subscription: {
          cycle: 'MONTHLY',
          nextDueDate: nextDueDateStr,
          endDate: endDateStr,
          externalReference: `pending-operator-${pendingOperatorId}`, // ExternalReference na subscription
        },
        items: [
          {
            name: 'Licença Operador',
            description: `Acesso completo à plataforma - ${data.operatorData.email}`,
            value: 19.90,
            quantity: 1,
          }
        ],
        callback: {
          successUrl: getFullUrl(`/${data.managerId}/manager-users?operatorAdded=true`),
          cancelUrl: getFullUrl(`/${data.managerId}/manager-users?operatorCanceled=true`),
          expiredUrl: getFullUrl(`/${data.managerId}/manager-users?operatorExpired=true`),
          autoRedirect: true,
        },
      };

      const checkout = await asaasFetch(asaasApi.checkouts, {
        method: 'POST',
        body: JSON.stringify(checkoutData),
      });

      console.info('✅ [createOperatorCheckout] Checkout criado:', checkout.id);

      // 5. Atualizar pendingOperator com checkoutId
      await prisma.pendingOperator.update({
        where: { id: pendingOperatorId },
        data: { paymentId: checkout.id }
      });

      // 6. Construir URL do checkout
      const checkoutUrl = `https://${getIsProduction() ? 'www' : 'sandbox'}.asaas.com/checkoutSession/show?id=${checkout.id}`;
      console.info('🔗 [createOperatorCheckout] Checkout URL:', checkoutUrl);

      console.info('🎉 [createOperatorCheckout] Checkout criado com sucesso!');

      return new Output(
        true,
        ['Checkout criado com sucesso'],
        [],
        {
          checkoutUrl,
          checkoutId: checkout.id,
          pendingOperatorId,
        }
      );

    } catch (error: any) {
      console.error('❌ [createOperatorCheckout] Erro:', error);

      // Rollback: deletar pendingOperator se foi criado
      if (pendingOperatorId) {
        try {
          console.warn('🔄 [createOperatorCheckout] Rollback: Deletando pendingOperator...');
          await prisma.pendingOperator.delete({
            where: { id: pendingOperatorId }
          });
          console.info('✅ [createOperatorCheckout] Rollback concluído');
        } catch (rollbackError) {
          console.error('❌ [createOperatorCheckout] Erro no rollback:', rollbackError);
        }
      }

      // Traduzir mensagens de erro comuns do Asaas
      let errorMessage = error.message || 'Erro desconhecido';
      
      if (errorMessage.includes('domínio')) {
        errorMessage = 'Configure um domínio na sua conta Asaas para criar checkouts. Acesse: Minha Conta → Informações';
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
   * Processa webhook quando checkout de operador é pago
   * Incrementa assinatura do manager e cria operador
   * @param checkoutSessionId - ID da sessão de checkout (checkoutSession do payment)
   * @param paymentId - ID do pagamento confirmado
   */
  async processOperatorCheckoutPaid(checkoutSessionId: string, paymentId: string): Promise<Output> {
    try {
      console.info('💰 [processOperatorCheckoutPaid] Processando pagamento:', {
        checkoutSessionId,
        paymentId
      });

      // 1. Buscar pendingOperator pelo checkoutSessionId (salvo como paymentId)
      const pendingOperator = await prisma.pendingOperator.findFirst({
        where: { paymentId: checkoutSessionId },
        include: { manager: true }
      });

      if (!pendingOperator) {
        console.warn('⚠️ [processOperatorCheckoutPaid] PendingOperator não encontrado para checkoutSessionId:', checkoutSessionId);
        return new Output(false, [], ['Operador pendente não encontrado'], null);
      }

      if (pendingOperator.operatorCreated) {
        console.info('ℹ️ [processOperatorCheckoutPaid] Operador já foi criado anteriormente');
        return new Output(false, [], ['Operador já foi criado'], null);
      }

      // 2. Buscar payment no Asaas para obter subscription
      const payment = await asaasFetch(
        `${asaasApi.payments}/${paymentId}`,
        { method: 'GET' }
      );

      if (!payment.subscription) {
        console.warn('⚠️ [processOperatorCheckoutPaid] Pagamento não vinculado a subscription');
        return new Output(false, [], ['Pagamento não vinculado a assinatura'], null);
      }

      const newSubscriptionId = payment.subscription;
      console.info('📋 [processOperatorCheckoutPaid] Informações:', {
        paymentId,
        subscriptionId: newSubscriptionId,
        checkoutSessionId
      });

      // 3. CRÍTICO: Atualizar assinatura do manager no Asaas
      // Buscar assinatura antiga e nova
      const manager = pendingOperator.manager;
      const oldSubscriptionId = manager.asaasSubscriptionId;

      if (!oldSubscriptionId) {
        return new Output(false, [], ['Manager não possui assinatura anterior'], null);
      }

      console.info('🔍 [processOperatorCheckoutPaid] Buscando assinaturas:', {
        old: oldSubscriptionId,
        new: newSubscriptionId
      });

      // Buscar valor atual da assinatura antiga
      const oldSubscription = await asaasFetch(
        `${asaasApi.subscriptions}/${oldSubscriptionId}`,
        { method: 'GET' }
      );

      const newValue = oldSubscription.value + 19.90;
      console.info('💰 [processOperatorCheckoutPaid] Incrementando valor:', {
        oldValue: oldSubscription.value,
        newValue,
        increment: 19.90
      });

      // Atualizar assinatura antiga com novo valor
      await asaasFetch(
        `${asaasApi.subscriptions}/${oldSubscriptionId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ value: newValue })
        }
      );

      console.info('✅ [processOperatorCheckoutPaid] Assinatura do manager atualizada');

      // Cancelar nova subscription (usamos apenas para gerar o checkout)
      try {
        await asaasFetch(
          `${asaasApi.subscriptions}/${newSubscriptionId}`,
          {
            method: 'DELETE'
          }
        );
        console.info('✅ [processOperatorCheckoutPaid] Nova subscription cancelada');
      } catch (cancelError) {
        console.warn('⚠️ [processOperatorCheckoutPaid] Erro ao cancelar nova subscription:', cancelError);
        // Não bloqueia o fluxo
      }

      // 4. Criar usuário no Supabase Auth
      console.info('👤 [processOperatorCheckoutPaid] Criando usuário no Supabase...');
      
      const supabaseAdmin = createSupabaseAdminClient();
      if (!supabaseAdmin) {
        return new Output(false, [], ['Erro ao conectar com autenticação'], null);
      }

      // Gerar senha temporária
      const tempPassword = Math.random().toString(36).slice(-12);
      
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: pendingOperator.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: pendingOperator.name,
          role: pendingOperator.role,
          manager_id: manager.supabaseId,
        }
      });

      if (authError || !authUser?.user) {
        console.error('❌ [processOperatorCheckoutPaid] Erro ao criar usuário:', authError);
        return new Output(false, [], ['Erro ao criar usuário no sistema de autenticação'], null);
      }

      console.info('✅ [processOperatorCheckoutPaid] Usuário criado no Supabase:', authUser.user.id);

      // 5. Criar perfil do operador no banco
      const operator = await prisma.profile.create({
        data: {
          supabaseId: authUser.user.id,
          fullName: pendingOperator.name,
          email: pendingOperator.email,
          role: pendingOperator.role as any,
          managerId: manager.id,
          subscriptionStatus: 'active',
          subscriptionPlan: null, // Operadores não têm plano próprio
        }
      });

      console.info('✅ [processOperatorCheckoutPaid] Operador criado no banco:', operator.id);

      // 6. Deletar pendingOperator (já foi processado)
      await prisma.pendingOperator.delete({
        where: { id: pendingOperator.id }
      });

      console.info('✅ [processOperatorCheckoutPaid] PendingOperator removido da fila');

      // 7. Incrementar contador de operadores no manager
      await prisma.profile.update({
        where: { id: manager.id },
        data: {
          operatorCount: { increment: 1 }
        }
      });

      console.info('✅ [processOperatorCheckoutPaid] Contador do manager incrementado');

      // 8. Enviar e-mail de convite para operador
      try {
        const emailService = getEmailService();
        const inviteUrl = getFullUrl('/set-password');

        await emailService.sendOperatorInviteEmail({
          operatorName: pendingOperator.name,
          operatorEmail: pendingOperator.email,
          operatorRole: pendingOperator.role,
          managerName: manager.fullName || manager.email,
          inviteUrl,
        });

        console.info('✅ [processOperatorCheckoutPaid] E-mail de convite enviado');
      } catch (emailError) {
        console.warn('⚠️ [processOperatorCheckoutPaid] Erro ao enviar e-mail:', emailError);
        // Não bloqueia o fluxo
      }

      console.info('🎉 [processOperatorCheckoutPaid] Operador criado com sucesso!');

      return new Output(
        true,
        ['Operador criado com sucesso'],
        [],
        {
          operatorId: operator.id,
          operatorEmail: operator.email,
        }
      );

    } catch (error: any) {
      console.error('❌ [processOperatorCheckoutPaid] Erro:', error);
      
      return new Output(
        false,
        [],
        ['Erro ao processar pagamento do operador'],
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
