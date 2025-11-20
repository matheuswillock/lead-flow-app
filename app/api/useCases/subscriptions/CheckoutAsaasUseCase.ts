import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasFetch } from "@/lib/asaas";

export interface CreateCheckoutData {
  supabaseId: string;
  fullName: string;
  email: string;
  phone: string;
  cpfCnpj?: string;
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

      let asaasCustomerId = profile.asaasCustomerId;

      // Criar cliente no Asaas se não existir
      if (!asaasCustomerId) {
        console.info('👤 [createSubscriptionCheckout] Criando cliente no Asaas...');
        
        const customerData: any = {
          name: data.fullName,
          email: data.email,
          mobilePhone: data.phone?.replace(/\D/g, '') || undefined,
        };

        if (data.cpfCnpj) {
          customerData.cpfCnpj = data.cpfCnpj.replace(/\D/g, '');
        }

        const customer = await asaasFetch(`${process.env.ASAAS_URL}/api/v3/customers`, {
          method: 'POST',
          body: JSON.stringify(customerData),
        });

        asaasCustomerId = customer.id;

        // Salvar customer ID no profile
        await prisma.profile.update({
          where: { supabaseId: data.supabaseId },
          data: { asaasCustomerId }
        });

        console.info('✅ [createSubscriptionCheckout] Cliente Asaas criado:', asaasCustomerId);
      }

      // 2. Criar assinatura no Asaas
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 7); // 7 dias para primeira cobrança
      const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

      console.info('📝 [createSubscriptionCheckout] Criando assinatura no Asaas...');

      const subscriptionData = {
        customer: asaasCustomerId,
        billingType: 'UNDEFINED', // Cliente escolhe forma de pagamento
        nextDueDate: nextDueDateStr,
        value: 59.90, // Plano base sem operadores
        cycle: 'MONTHLY',
        description: 'Plano Manager Lead Flow',
        callback: {
          successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout-return`,
          autoRedirect: true,
        },
      };

      const subscription = await asaasFetch(`${process.env.ASAAS_URL}/api/v3/subscriptions`, {
        method: 'POST',
        body: JSON.stringify(subscriptionData),
      });

      console.info('✅ [createSubscriptionCheckout] Assinatura criada:', subscription.id);

      // 3. Buscar primeira cobrança gerada pela assinatura
      console.info('🔍 [createSubscriptionCheckout] Buscando cobranças da assinatura...');
      
      const payments = await asaasFetch(
        `${process.env.ASAAS_URL}/api/v3/subscriptions/${subscription.id}/payments`,
        { method: 'GET' }
      );

      if (!payments.data || payments.data.length === 0) {
        return new Output(
          false,
          [],
          ['Erro ao gerar cobrança da assinatura'],
          null
        );
      }

      const firstPayment = payments.data[0];
      console.info('✅ [createSubscriptionCheckout] Primeira cobrança:', firstPayment.id);

      // 4. Salvar informações temporárias no profile
      await prisma.profile.update({
        where: { supabaseId: data.supabaseId },
        data: {
          asaasSubscriptionId: subscription.id,
          subscriptionNextDueDate: new Date(subscription.nextDueDate),
          subscriptionCycle: subscription.cycle,
          subscriptionStatus: 'trial', // Aguardando primeiro pagamento
          subscriptionPlan: 'manager_base',
        }
      });

      // 5. Retornar URL da fatura para checkout
      const checkoutUrl = firstPayment.invoiceUrl;

      console.info('🎉 [createSubscriptionCheckout] Checkout criado com sucesso!');

      return new Output(
        true,
        ['Checkout criado com sucesso'],
        [],
        {
          checkoutUrl,
          subscriptionId: subscription.id,
          paymentId: firstPayment.id,
          dueDate: firstPayment.dueDate,
          value: firstPayment.value,
        }
      );

    } catch (error: any) {
      console.error('❌ [createSubscriptionCheckout] Erro:', error);
      
      return new Output(
        false,
        [],
        ['Erro ao criar checkout: ' + (error.message || 'Erro desconhecido')],
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
        `${process.env.ASAAS_URL}/api/v3/payments/${checkoutId}`,
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
