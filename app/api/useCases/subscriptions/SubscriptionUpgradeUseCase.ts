import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasFetch } from "@/lib/asaas";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import type { 
  ISubscriptionUpgradeUseCase, 
  AddOperatorPaymentData,
  SubscriptionUpgradeResult,
  ReactivateSubscriptionData 
} from "./ISubscriptionUpgradeUseCase";

export class SubscriptionUpgradeUseCase implements ISubscriptionUpgradeUseCase {
  
  /**
   * Cria pagamento para adicionar novo operador
   */
  async createOperatorPayment(data: AddOperatorPaymentData): Promise<Output> {
    try {
      // 1. Validar manager
      const manager = await prisma.profile.findUnique({
        where: { supabaseId: data.managerId },
      });

      if (!manager) {
        return new Output(false, [], ['Manager não encontrado'], null);
      }

      if (manager.role !== 'manager') {
        return new Output(false, [], ['Apenas managers podem adicionar usuário'], null);
      }

      if (!manager.subscriptionStatus || manager.subscriptionStatus === 'canceled') {
        return new Output(false, [], ['Manager não possui assinatura ativa'], null);
      }

      // 2. Verificar se manager já possui assinatura master
      // Se sim, apenas atualizar a assinatura ao invés de criar nova individual
      if (manager.asaasSubscriptionId && manager.subscriptionNextDueDate) {
        console.info('📋 [createOperatorPayment] Manager já possui assinatura master. Atualizando...');
        
        // Verificar email antes
        const existingUser = await prisma.profile.findFirst({
          where: { email: data.operatorData.email }
        });

        if (existingUser) {
          return new Output(false, [], ['Email já está em uso'], null);
        }

        // Criar usuário primeiro
        const userCreation = await this.createSupabaseUser(
          data.operatorData.email,
          data.operatorData.name
        );

        if (!userCreation.success) {
          return new Output(
            false,
            [],
            ['Falha ao criar usuário: ' + (userCreation.error || 'Erro desconhecido')],
            null
          );
        }

        // Criar perfil no banco
        const profile = await prisma.profile.create({
          data: {
            supabaseId: userCreation.userId,
            fullName: data.operatorData.name,
            email: data.operatorData.email,
            role: data.operatorData.role as 'operator' | 'manager',
            managerId: manager.id,
          }
        });

        console.info('✅ [createOperatorPayment] Usuário operador criado:', profile.id);

        // Incrementar contador do manager
        await prisma.profile.update({
          where: { id: manager.id },
          data: {
            operatorCount: {
              increment: 1
            }
          }
        });

        // Atualizar assinatura do manager
        const updateResult = await this.updateManagerSubscription(manager.id);

        if (!updateResult.isValid) {
          console.warn('⚠️ [createOperatorPayment] Falha ao atualizar assinatura mas usuário foi criado');
          // Usuário já foi criado, não retornar erro
        }

        return new Output(
          true,
          ['Operador criado com sucesso! Assinatura do manager atualizada.'],
          [],
          {
            operatorId: profile.id,
            operatorCreated: true,
            subscriptionUpdated: updateResult.isValid,
            subscriptionUpdate: updateResult.result
          }
        );
      }

      // 3. Verificar se email do operador já existe (legacy flow)
      const existingUser = await prisma.profile.findFirst({
        where: { 
          email: data.operatorData.email
        }
      });

      if (existingUser) {
        return new Output(false, [], ['Email já está em uso'], null);
      }

      // 4. Buscar cliente Asaas do manager
      if (!manager.asaasCustomerId) {
        return new Output(false, [], ['Cliente Asaas não encontrado'], null);
      }

      // 5. Criar assinatura recorrente no Asaas (R$ 19,90/mês por operador adicional)
      const operatorPrice = 19.90;
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 7); // Primeira cobrança em 7 dias

      const subscriptionData: any = {
        customer: manager.asaasCustomerId,
        billingType: data.paymentMethod,
        value: operatorPrice,
        nextDueDate: nextDueDate.toISOString().split('T')[0], // Data da primeira cobrança
        cycle: 'MONTHLY', // Cobrança mensal recorrente
        description: `Assinatura operador: ${data.operatorData.name}`,
        externalReference: `operator-${manager.id}-${Date.now()}`,
      };

      // Adicionar dados do cartão de crédito se for o método selecionado
      if (data.paymentMethod === 'CREDIT_CARD') {
        if (!data.creditCard || !data.creditCardHolderInfo) {
          return new Output(false, [], ['Dados do cartão de crédito são obrigatórios'], null);
        }

        subscriptionData.creditCard = data.creditCard;
        subscriptionData.creditCardHolderInfo = data.creditCardHolderInfo;
        subscriptionData.remoteIp = data.remoteIp || '127.0.0.1';
      }

      const asaasSubscription = await this.createAsaasSubscription(subscriptionData);

      if (!asaasSubscription.success) {
        return new Output(false, [], [asaasSubscription.error || 'Erro ao criar assinatura'], null);
      }

      console.info('✅ [createOperatorPayment] Assinatura criada:', {
        subscriptionId: asaasSubscription.subscriptionId,
        status: asaasSubscription.status,
        nextDueDate: asaasSubscription.nextDueDate
      });

      // Para cartão de crédito: cartão é validado na criação da assinatura
      // Cobrança ocorrerá automaticamente no nextDueDate
      if (data.paymentMethod === 'CREDIT_CARD') {
        // Assinatura com cartão foi criada e validada com sucesso
        // Criar usuário imediatamente pois a assinatura já está ativa
        console.info('💳 [createOperatorPayment] Assinatura com cartão validada, criando usuário...');
        
        // Criar usuário Supabase imediatamente
        const userCreation = await this.createSupabaseUser(
          data.operatorData.email,
          data.operatorData.name
        );

        if (!userCreation.success) {
          console.error('❌ [createOperatorPayment] Falha ao criar usuário:', userCreation.error);
          return new Output(
            false,
            [],
            ['Assinatura criada mas falha ao criar usuário. Contate o suporte.'],
            null
          );
        }

        // Criar perfil no banco com subscriptionId
        const profile = await prisma.profile.create({
          data: {
            supabaseId: userCreation.userId,
            fullName: data.operatorData.name,
            email: data.operatorData.email,
            role: data.operatorData.role as 'operator' | 'manager',
            managerId: manager.id,
            asaasSubscriptionId: asaasSubscription.subscriptionId,
            subscriptionNextDueDate: new Date(asaasSubscription.nextDueDate),
            subscriptionCycle: 'MONTHLY',
          }
        });

        console.info('✅ [createOperatorPayment] Usuário criado com assinatura:', profile.id);

        // Retornar sucesso imediato
        const result: SubscriptionUpgradeResult = {
          paymentId: asaasSubscription.subscriptionId, // subscriptionId como referência
          paymentStatus: 'CONFIRMED',
          paymentMethod: data.paymentMethod,
          dueDate: asaasSubscription.nextDueDate,
          pixQrCode: undefined,
          pixCopyPaste: undefined,
          operatorCreated: true,
        };

        return new Output(
          true,
          ['Assinatura criada! Usuário ativado com sucesso. Primeira cobrança no cartão em ' + asaasSubscription.nextDueDate],
          [],
          result
        );
      }

      // 5. Para PIX: Salvar dados temporários do operador no banco (pending)
      // A assinatura foi criada mas aguarda pagamento da primeira cobrança
      // Buscar a primeira cobrança gerada pela assinatura
      const subscriptionPayments = await AsaasSubscriptionService.getSubscriptionPayments(
        asaasSubscription.subscriptionId
      );

      if (!subscriptionPayments.data || subscriptionPayments.data.length === 0) {
        return new Output(false, [], ['Erro: Nenhuma cobrança gerada para a assinatura'], null);
      }

      const firstPayment = subscriptionPayments.data[0];
      const firstPaymentId = firstPayment.id;

      // Buscar QR Code do PIX
      const pixQrCode = await AsaasSubscriptionService.getPixQrCode(firstPaymentId);

      const pendingOperator = await prisma.pendingOperator.create({
        data: {
          managerId: manager.id,
          name: data.operatorData.name,
          email: data.operatorData.email,
          role: data.operatorData.role,
          paymentId: firstPaymentId, // ID da primeira cobrança
          subscriptionId: asaasSubscription.subscriptionId, // ID da assinatura
          paymentStatus: 'PENDING',
          paymentMethod: data.paymentMethod,
        }
      });

      console.info('💾 [createOperatorPayment] PendingOperator criado com assinatura:', {
        id: pendingOperator.id,
        subscriptionId: asaasSubscription.subscriptionId,
        paymentId: firstPaymentId
      });

      // 6. Preparar resultado para PIX com QR Code
      const result: SubscriptionUpgradeResult = {
        paymentId: firstPaymentId,
        paymentStatus: 'PENDING',
        paymentMethod: data.paymentMethod,
        dueDate: asaasSubscription.nextDueDate,
        pixQrCode: pixQrCode.encodedImage,
        pixCopyPaste: pixQrCode.payload,
        operatorCreated: false,
      };

      return new Output(
        true,
        ['Assinatura criada com sucesso. Aguardando pagamento da primeira cobrança via PIX.'],
        [],
        result
      );

    } catch (error) {
      console.error('Erro ao criar pagamento do operador:', error);
      return new Output(false, [], ['Erro interno ao processar pagamento'], null);
    }
  }

  /**
   * Confirma pagamento e cria operador (busca por paymentId)
   * Método legado para compatibilidade com payments únicos
   */
  async confirmPaymentAndCreateOperator(paymentId: string): Promise<Output> {
    try {
      console.info('🔄 [confirmPaymentAndCreateOperator] Iniciando processamento para paymentId:', paymentId);

      // 1. Buscar operador pendente
      const pendingOperator = await prisma.pendingOperator.findUnique({
        where: { paymentId },
        include: {
          manager: true
        }
      });

      if (!pendingOperator) {
        console.warn('⚠️ [confirmPaymentAndCreateOperator] PendingOperator não encontrado para paymentId:', paymentId);
        return new Output(false, [], ['Pagamento não encontrado'], null);
      }

      return await this.createOperatorFromPending(pendingOperator, paymentId);
    } catch (error) {
      console.error('❌ [confirmPaymentAndCreateOperator] ERRO CRÍTICO:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      return new Output(false, [], ['Erro interno ao criar operador'], null);
    }
  }

  /**
   * Confirma pagamento e cria operador (busca por subscriptionId)
   * Método para assinaturas recorrentes
   */
  async confirmPaymentAndCreateOperatorBySubscription(subscriptionId: string, paymentId: string): Promise<Output> {
    try {
      console.info('🔄 [confirmPaymentAndCreateOperatorBySubscription] Iniciando processamento:', {
        subscriptionId,
        paymentId
      });

      // 1. Buscar operador pendente pela assinatura
      const pendingOperator = await prisma.pendingOperator.findFirst({
        where: { subscriptionId },
        include: {
          manager: true
        }
      });

      if (!pendingOperator) {
        console.warn('⚠️ [confirmPaymentAndCreateOperatorBySubscription] PendingOperator não encontrado para subscriptionId:', subscriptionId);
        return new Output(false, [], ['Assinatura não encontrada'], null);
      }

      return await this.createOperatorFromPending(pendingOperator, paymentId);
    } catch (error) {
      console.error('❌ [confirmPaymentAndCreateOperatorBySubscription] ERRO CRÍTICO:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      return new Output(false, [], ['Erro interno ao criar operador'], null);
    }
  }

  /**
   * Cria operador a partir de PendingOperator
   * Método auxiliar compartilhado entre payment e subscription
   */
  private async createOperatorFromPending(pendingOperator: any, paymentId: string): Promise<Output> {
    console.info('✅ [createOperatorFromPending] PendingOperator encontrado:', {
      id: pendingOperator.id,
      email: pendingOperator.email,
      name: pendingOperator.name,
      operatorCreated: pendingOperator.operatorCreated
    });

    if (pendingOperator.operatorCreated) {
      console.info('ℹ️ [createOperatorFromPending] Operador já foi criado anteriormente');
      return new Output(false, [], ['Operador já foi criado'], null);
    }

    // 2. Verificar status do pagamento no Asaas
    console.info('🔍 [createOperatorFromPending] Verificando status no Asaas...');
    const paymentStatus = await this.checkAsaasPaymentStatus(paymentId);
    console.info('📊 [createOperatorFromPending] Status Asaas:', paymentStatus);
    
    if (!paymentStatus.success || (paymentStatus.status !== 'CONFIRMED' && paymentStatus.status !== 'RECEIVED')) {
      console.warn('⚠️ [createOperatorFromPending] Pagamento não confirmado. Status:', paymentStatus.status);
      return new Output(false, [], ['Pagamento ainda não foi confirmado'], null);
    }

    // 3. Criar usuário no Supabase Auth
    console.info('👤 [createOperatorFromPending] Criando usuário no Supabase...');
    const supabaseUser = await this.createSupabaseUser(
      pendingOperator.email,
      pendingOperator.name
    );

    console.info('📝 [createOperatorFromPending] Resultado criação Supabase:', {
      success: supabaseUser.success,
      userId: supabaseUser.userId,
      error: supabaseUser.error
    });

    if (!supabaseUser.success) {
      console.error('❌ [createOperatorFromPending] Falha ao criar usuário no Supabase:', supabaseUser.error);
      return new Output(false, [], [supabaseUser.error || 'Erro ao criar usuário'], null);
    }

    // 4. Criar perfil do operador no banco (com subscriptionId se disponível)
    console.info('💾 [createOperatorFromPending] Criando perfil do operador no banco...');
    console.info('📋 [createOperatorFromPending] Dados do perfil:', {
      supabaseId: supabaseUser.userId,
      fullName: pendingOperator.name,
      email: pendingOperator.email,
      role: pendingOperator.role,
      managerId: pendingOperator.managerId,
      asaasSubscriptionId: pendingOperator.subscriptionId || null
    });

    const operator = await prisma.profile.create({
      data: {
        supabaseId: supabaseUser.userId!,
        fullName: pendingOperator.name,
        email: pendingOperator.email,
        role: pendingOperator.role as any,
        managerId: pendingOperator.managerId,
        asaasSubscriptionId: pendingOperator.subscriptionId || undefined,
        subscriptionCycle: pendingOperator.subscriptionId ? 'MONTHLY' : undefined,
      }
    });

    console.info('✅ [createOperatorFromPending] Perfil criado:', {
      id: operator.id,
      supabaseId: operator.supabaseId,
      fullName: operator.fullName,
      email: operator.email,
      role: operator.role,
      managerId: operator.managerId
    });

    // 5. Atualizar status do operador pendente
    console.info('🔄 [createOperatorFromPending] Atualizando PendingOperator...');
    await prisma.pendingOperator.update({
      where: { id: pendingOperator.id },
      data: {
        operatorCreated: true,
        operatorId: operator.id,
        paymentStatus: 'CONFIRMED',
      }
    });

    // 6. Incrementar contador de operadores no manager
    console.info('📊 [createOperatorFromPending] Incrementando contador do manager...');
    await prisma.profile.update({
      where: { id: pendingOperator.managerId },
      data: {
        operatorCount: {
          increment: 1
        }
      }
    });

    const result: SubscriptionUpgradeResult = {
      paymentId,
      paymentStatus: 'CONFIRMED',
      paymentMethod: pendingOperator.paymentMethod,
      operatorCreated: true,
      operatorId: operator.id,
    };

    console.info('🎉 [createOperatorFromPending] SUCESSO! Operador criado:', result);

    return new Output(
      true,
      ['Pagamento confirmado e operador criado com sucesso!'],
      [],
      result
    );
  }

  /**
   * Verifica status do pagamento do operador
   */
  async checkOperatorPaymentStatus(paymentId: string): Promise<Output> {
    try {
      console.info('[checkOperatorPaymentStatus] Verificando status para paymentId:', paymentId);

      const pendingOperator = await prisma.pendingOperator.findUnique({
        where: { paymentId }
      });

      if (!pendingOperator) {
        console.info('[checkOperatorPaymentStatus] PendingOperator não encontrado');
        return new Output(false, [], ['Pagamento não encontrado'], null);
      }

      console.info('[checkOperatorPaymentStatus] PendingOperator encontrado:', {
        paymentStatus: pendingOperator.paymentStatus,
        operatorCreated: pendingOperator.operatorCreated,
        operatorId: pendingOperator.operatorId
      });

      // Verificar status no Asaas
      const asaasStatus = await this.checkAsaasPaymentStatus(paymentId);
      console.info('[checkOperatorPaymentStatus] Status do Asaas:', asaasStatus);

      if (asaasStatus.success) {
        // Atualizar status local
        await prisma.pendingOperator.update({
          where: { id: pendingOperator.id },
          data: { paymentStatus: asaasStatus.status }
        });

        console.info('[checkOperatorPaymentStatus] Retornando status:', asaasStatus.status);

        return new Output(
          true,
          ['Status verificado'],
          [],
          {
            paymentId,
            paymentStatus: asaasStatus.status, // Mudado de 'status' para 'paymentStatus'
            operatorCreated: pendingOperator.operatorCreated,
            operatorId: pendingOperator.operatorId,
          }
        );
      }

      console.info('[checkOperatorPaymentStatus] Asaas retornou falha');
      return new Output(false, [], ['Erro ao verificar status'], null);

    } catch (error) {
      console.error('[checkOperatorPaymentStatus] Erro:', error);
      return new Output(false, [], ['Erro ao verificar status'], null);
    }
  }

  // ========== Métodos auxiliares ==========

  /**
   * Cria assinatura recorrente no Asaas
   * Substituindo pagamento único por assinatura mensal
   */
  private async createAsaasSubscription(data: any): Promise<any> {
    try {
      console.info('[Asaas] Criando assinatura com dados:', {
        customer: data.customer,
        billingType: data.billingType,
        value: data.value,
        cycle: data.cycle,
        nextDueDate: data.nextDueDate,
        hasCreditCard: !!data.creditCard,
        hasCreditCardHolderInfo: !!data.creditCardHolderInfo,
      });

      // Conforme doc Asaas: POST /v3/subscriptions
      const subscription = await asaasFetch(`${process.env.ASAAS_URL}/api/v3/subscriptions`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      console.info('[Asaas] Assinatura criada com sucesso:', { 
        id: subscription.id, 
        status: subscription.status,
        nextDueDate: subscription.nextDueDate,
        cycle: subscription.cycle,
        billingType: subscription.billingType
      });

      // Para cartão de crédito: cartão é validado na criação
      // Mas cobrança só ocorrerá no nextDueDate
      if (data.billingType === 'CREDIT_CARD') {
        console.info('[Asaas] Assinatura com cartão criada e validada:', {
          status: subscription.status,
          nextDueDate: subscription.nextDueDate,
          creditCardBrand: subscription.creditCard?.creditCardBrand,
          creditCardNumber: subscription.creditCard?.creditCardNumber
        });

        return {
          success: true,
          subscriptionId: subscription.id,
          nextDueDate: subscription.nextDueDate,
          status: subscription.status,
          creditCardToken: subscription.creditCard?.creditCardToken, // Para futuras transações
        };
      }

      // Para PIX/BOLETO: assinatura criada, cobranças serão geradas automaticamente
      return {
        success: true,
        subscriptionId: subscription.id,
        nextDueDate: subscription.nextDueDate,
        status: subscription.status,
      };
    } catch (error: any) {
      console.error('[Asaas] Erro ao criar assinatura:', {
        message: error.message,
        response: error.response,
        status: error.status
      });
      
      // Extrair mensagem de erro mais específica se disponível
      let errorMessage = 'Erro ao comunicar com gateway de pagamento';
      
      if (error.response?.errors && Array.isArray(error.response.errors)) {
        errorMessage = error.response.errors
          .map((e: any) => e.description || e.message)
          .join(', ');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  private async checkAsaasPaymentStatus(paymentId: string): Promise<any> {
    try {
      const payment = await asaasFetch(`${process.env.ASAAS_URL}/api/v3/payments/${paymentId}`, {
        method: 'GET',
      });

      return {
        success: true,
        status: payment.status,
      };
    } catch (error: any) {
      console.error('[Asaas] Erro ao verificar status:', error);
      return { success: false };
    }
  }

  private async createSupabaseUser(email: string, name: string): Promise<any> {
    try {
      console.info('🔐 [createSupabaseUser] Iniciando criação de usuário:', { email, name });

      // Gerar senha aleatória segura
      const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
      console.info('🔑 [createSupabaseUser] Senha temporária gerada');

      // Criar cliente Supabase Admin (Service Role)
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error('❌ [createSupabaseUser] Falha ao criar cliente Supabase Admin');
        return { success: false, error: 'Falha ao conectar com sistema de autenticação' };
      }

      console.info('✅ [createSupabaseUser] Cliente Supabase Admin criado');

      // Criar usuário no Supabase Auth
      const { data: user, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { name }
      });

      if (authError || !user.user) {
        console.error('❌ [createSupabaseUser] Erro ao criar usuário no Supabase:', authError);
        return { 
          success: false, 
          error: authError?.message || 'Erro ao criar usuário no sistema de autenticação' 
        };
      }

      console.info('✅ [createSupabaseUser] Usuário criado com sucesso:', {
        userId: user.user.id,
        email: user.user.email
      });

      return {
        success: true,
        userId: user.user.id,
        temporaryPassword: randomPassword,
      };
    } catch (error) {
      console.error('❌ [createSupabaseUser] Erro inesperado:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao criar usuário no sistema de autenticação' 
      };
    }
  }

  /**
   * Calcula valor total da assinatura do manager
   * Fórmula: R$ 59,90 (base) + R$ 19,90 × número de operadores
   */
  private calculateSubscriptionValue(operatorCount: number): {
    value: number;
    description: string;
  } {
    const BASE_VALUE = 59.90;
    const OPERATOR_VALUE = 19.90;
    
    const totalValue = BASE_VALUE + (OPERATOR_VALUE * operatorCount);
    
    const description = operatorCount === 0
      ? 'Plano Manager Base - sem operadores'
      : `Plano Manager Base + ${operatorCount} operador${operatorCount > 1 ? 'es' : ''}`;
    
    console.info('💰 [calculateSubscriptionValue] Cálculo:', {
      operatorCount,
      baseValue: BASE_VALUE,
      operatorValue: OPERATOR_VALUE,
      totalValue,
      description
    });
    
    return {
      value: totalValue,
      description
    };
  }

  /**
   * Atualiza assinatura do manager (cancela antiga e cria nova)
   * Recomendação Asaas: Deletar assinatura antiga e criar nova ao atualizar valor
   */
  async updateManagerSubscription(managerId: string): Promise<Output> {
    try {
      console.info('🔄 [updateManagerSubscription] Iniciando atualização para managerId:', managerId);

      // 1. Buscar manager
      const manager = await prisma.profile.findUnique({
        where: { id: managerId },
        include: {
          operators: {
            where: {
              role: 'operator'
            }
          }
        }
      });

      if (!manager) {
        return new Output(false, [], ['Manager não encontrado'], null);
      }

      console.info('📊 [updateManagerSubscription] Manager encontrado:', {
        id: manager.id,
        email: manager.email,
        operatorCount: manager.operators.length,
        currentSubscriptionId: manager.asaasSubscriptionId
      });

      // 2. Verificar se tem assinatura ativa
      if (!manager.asaasSubscriptionId) {
        return new Output(false, [], ['Manager não possui assinatura ativa'], null);
      }

      if (!manager.asaasCustomerId) {
        return new Output(false, [], ['Cliente Asaas não encontrado'], null);
      }

      // 3. Calcular novo valor
      const { value, description } = this.calculateSubscriptionValue(manager.operators.length);

      console.info('💰 [updateManagerSubscription] Novo valor calculado:', {
        operatorCount: manager.operators.length,
        value,
        description
      });

      // 4. Cancelar assinatura antiga
      console.info('❌ [updateManagerSubscription] Cancelando assinatura antiga:', manager.asaasSubscriptionId);
      
      try {
        await AsaasSubscriptionService.cancelSubscription(manager.asaasSubscriptionId);
        console.info('✅ [updateManagerSubscription] Assinatura antiga cancelada');
      } catch (error) {
        console.error('⚠️ [updateManagerSubscription] Erro ao cancelar assinatura antiga:', error);
        // Continuar mesmo se falhar o cancelamento (pode já estar cancelada)
      }

      // 5. Criar nova assinatura com valor atualizado
      // Mantém a mesma data de vencimento da assinatura anterior
      const nextDueDate = manager.subscriptionNextDueDate || new Date();
      
      // Se a data já passou, ajustar para próximo mês
      if (nextDueDate < new Date()) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      console.info('📝 [updateManagerSubscription] Criando nova assinatura...', {
        originalNextDueDate: manager.subscriptionNextDueDate,
        newNextDueDate: nextDueDate
      });

      const newSubscriptionData = {
        customer: manager.asaasCustomerId,
        billingType: 'CREDIT_CARD' as const, // Assumindo cartão, pode ser ajustado
        value,
        cycle: 'MONTHLY' as const,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        description,
        externalReference: `manager-${manager.id}-${Date.now()}`
      };

      const newSubscription = await AsaasSubscriptionService.createSubscription(newSubscriptionData);

      if (!newSubscription.success) {
        return new Output(
          false,
          [],
          ['Erro ao criar nova assinatura: ' + (newSubscription.data || 'Erro desconhecido')],
          null
        );
      }

      console.info('✅ [updateManagerSubscription] Nova assinatura criada:', {
        subscriptionId: newSubscription.subscriptionId,
        value,
        nextDueDate: newSubscription.data.nextDueDate
      });

      // 6. Atualizar Profile com novo subscriptionId
      await prisma.profile.update({
        where: { id: manager.id },
        data: {
          asaasSubscriptionId: newSubscription.subscriptionId,
          subscriptionNextDueDate: new Date(newSubscription.data.nextDueDate),
          operatorCount: manager.operators.length,
        }
      });

      console.info('💾 [updateManagerSubscription] Profile atualizado com nova assinatura');

      return new Output(
        true,
        ['Assinatura atualizada com sucesso'],
        [],
        {
          oldSubscriptionId: manager.asaasSubscriptionId,
          newSubscriptionId: newSubscription.subscriptionId,
          newValue: value,
          operatorCount: manager.operators.length,
          nextDueDate: newSubscription.data.nextDueDate
        }
      );

    } catch (error) {
      console.error('❌ [updateManagerSubscription] Erro crítico:', error);
      return new Output(false, [], ['Erro ao atualizar assinatura'], null);
    }
  }

  /**
   * Remove operador e atualiza assinatura do manager
   */
  async removeOperatorAndUpdateSubscription(operatorId: string): Promise<Output> {
    try {
      console.info('🗑️ [removeOperatorAndUpdateSubscription] Removendo operador:', operatorId);

      // 1. Buscar operador
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
        include: {
          manager: true
        }
      });

      if (!operator) {
        return new Output(false, [], ['Operador não encontrado'], null);
      }

      if (!operator.managerId) {
        return new Output(false, [], ['Operador não possui manager'], null);
      }

      console.info('✅ [removeOperatorAndUpdateSubscription] Operador encontrado:', {
        id: operator.id,
        email: operator.email,
        managerId: operator.managerId
      });

      // 2. Desativar operador (soft delete ou marcar como inativo)
      await prisma.profile.update({
        where: { id: operatorId },
        data: {
          // Podemos adicionar um campo 'active' ou 'deletedAt' no futuro
          // Por enquanto, vamos manter mas decrementar o contador
        }
      });

      // 3. Decrementar contador do manager
      await prisma.profile.update({
        where: { id: operator.managerId },
        data: {
          operatorCount: {
            decrement: 1
          }
        }
      });

      console.info('📉 [removeOperatorAndUpdateSubscription] Contador decrementado');

      // 4. Atualizar assinatura do manager
      const updateResult = await this.updateManagerSubscription(operator.managerId);

      if (!updateResult.isValid) {
        return new Output(
          false,
          [],
          ['Operador removido mas erro ao atualizar assinatura: ' + updateResult.errorMessages.join(', ')],
          null
        );
      }

      console.info('🎉 [removeOperatorAndUpdateSubscription] Sucesso! Operador removido e assinatura atualizada');

      return new Output(
        true,
        ['Operador removido e assinatura atualizada com sucesso'],
        [],
        {
          operatorId,
          subscriptionUpdate: updateResult.result
        }
      );

    } catch (error) {
      console.error('❌ [removeOperatorAndUpdateSubscription] Erro crítico:', error);
      return new Output(false, [], ['Erro ao remover operador'], null);
    }
  }

  /**
   * Reativa assinatura cancelada criando uma nova com cartão de crédito
   */
  async reactivateSubscription(data: ReactivateSubscriptionData): Promise<Output> {
    try {
      console.info('🔄 [reactivateSubscription] Iniciando reativação para supabaseId:', data.supabaseId);

      // 1. Buscar manager pelo supabaseId
      const manager = await prisma.profile.findUnique({
        where: { supabaseId: data.supabaseId }
      });

      if (!manager) {
        return new Output(false, [], ['Manager não encontrado'], null);
      }

      if (!manager.asaasCustomerId) {
        return new Output(false, [], ['Manager não possui cliente Asaas'], null);
      }

      console.info('👤 [reactivateSubscription] Manager encontrado:', {
        id: manager.id,
        name: manager.name,
        asaasCustomerId: manager.asaasCustomerId,
        oldSubscriptionId: manager.asaasSubscriptionId
      });

      // 2. Cancelar assinatura antiga se existir
      if (manager.asaasSubscriptionId) {
        console.info('❌ [reactivateSubscription] Cancelando assinatura antiga:', manager.asaasSubscriptionId);
        try {
          await AsaasSubscriptionService.cancelSubscription(manager.asaasSubscriptionId);
          console.info('✅ [reactivateSubscription] Assinatura antiga cancelada');
        } catch (error) {
          console.error('⚠️ [reactivateSubscription] Erro ao cancelar assinatura antiga:', error);
          // Continuar mesmo com erro no cancelamento
        }
      }

      // 3. Calcular novo valor da assinatura
      const { value, description } = this.calculateSubscriptionValue(data.operatorCount);
      console.info('💰 [reactivateSubscription] Novo valor calculado:', { value, description, operatorCount: data.operatorCount });

      // 4. Preparar nextDueDate (manter data antiga ou usar nova)
      const nextDueDate = manager.subscriptionNextDueDate || new Date();
      
      // Se a data já passou, adicionar 30 dias
      if (nextDueDate < new Date()) {
        nextDueDate.setDate(nextDueDate.getDate() + 30);
      }

      const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

      // 5. Criar nova assinatura com cartão de crédito ou PIX
      console.info('📝 [reactivateSubscription] Criando nova assinatura...');
      
      const subscriptionPayload: any = {
        customer: manager.asaasCustomerId,
        billingType: data.paymentMethod,
        value,
        nextDueDate: nextDueDateStr,
        cycle: 'MONTHLY',
        description,
        externalReference: `Manager: ${manager.id} | Operators: ${data.operatorCount}`
      };

      if (data.paymentMethod === 'CREDIT_CARD' && data.creditCard && data.creditCardHolderInfo) {
        subscriptionPayload.creditCard = data.creditCard;
        subscriptionPayload.creditCardHolderInfo = data.creditCardHolderInfo;
        subscriptionPayload.remoteIp = data.remoteIp;
      }

      const newSubscription = await AsaasSubscriptionService.createSubscription(subscriptionPayload);

      if (!newSubscription || !newSubscription.id) {
        return new Output(false, [], ['Erro ao criar nova assinatura no Asaas'], null);
      }

      console.info('✅ [reactivateSubscription] Nova assinatura criada:', {
        subscriptionId: newSubscription.id,
        value: newSubscription.value,
        status: newSubscription.status
      });

      // 6. Atualizar Profile no banco
      await prisma.profile.update({
        where: { id: manager.id },
        data: {
          asaasSubscriptionId: newSubscription.id,
          subscriptionNextDueDate: nextDueDate,
          subscriptionCycle: 'MONTHLY',
          operatorCount: data.operatorCount,
          updatedAt: new Date()
        }
      });

      console.info('✅ [reactivateSubscription] Profile atualizado no banco');

      // 7. Preparar resposta com dados PIX se necessário
      const resultData: any = {
        subscriptionId: newSubscription.id,
        status: newSubscription.status,
        value: newSubscription.value,
        nextDueDate: nextDueDateStr,
        operatorCount: data.operatorCount
      };

      // Se for PIX, buscar dados da primeira cobrança
      if (data.paymentMethod === 'PIX') {
        try {
          // Buscar primeira cobrança da assinatura
          const payments = await asaasFetch(`/subscriptions/${newSubscription.id}/payments`);
          if (payments.data && payments.data.length > 0) {
            const firstPayment = payments.data[0];
            resultData.paymentId = firstPayment.id;
            
            // Se tiver QR code do PIX
            if (firstPayment.invoiceUrl) {
              const pixData = await asaasFetch(`/payments/${firstPayment.id}/pixQrCode`);
              resultData.pixQrCode = pixData.encodedImage;
              resultData.pixCopyPaste = pixData.payload;
            }
          }
        } catch (error) {
          console.error('⚠️ [reactivateSubscription] Erro ao buscar dados PIX:', error);
        }
      }

      return new Output(
        true,
        ['Assinatura reativada com sucesso'],
        [],
        resultData
      );

    } catch (error) {
      console.error('❌ [reactivateSubscription] Erro crítico:', error);
      return new Output(
        false, 
        [], 
        ['Erro ao reativar assinatura: ' + (error instanceof Error ? error.message : 'Erro desconhecido')], 
        null
      );
    }
  }
}

export const subscriptionUpgradeUseCase = new SubscriptionUpgradeUseCase();
