import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasFetch } from "@/lib/asaas";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { 
  ISubscriptionUpgradeUseCase, 
  AddOperatorPaymentData,
  SubscriptionUpgradeResult 
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

      // 2. Verificar se email do operador já existe
      const existingUser = await prisma.profile.findFirst({
        where: { 
          email: data.operatorData.email
        }
      });

      if (existingUser) {
        return new Output(false, [], ['Email já está em uso'], null);
      }

      // 3. Buscar cliente Asaas do manager
      if (!manager.asaasCustomerId) {
        return new Output(false, [], ['Cliente Asaas não encontrado'], null);
      }

      // 4. Criar cobrança no Asaas (R$ 19,90 por operador adicional)
      const operatorPrice = 19.90;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // 7 dias para pagamento

      const paymentData: any = {
        customer: manager.asaasCustomerId,
        billingType: data.paymentMethod,
        value: operatorPrice,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Adição de usuário: ${data.operatorData.name}`,
        externalReference: `operator-${manager.id}-${Date.now()}`,
      };

      // Adicionar dados do cartão de crédito se for o método selecionado
      if (data.paymentMethod === 'CREDIT_CARD') {
        if (!data.creditCard || !data.creditCardHolderInfo) {
          return new Output(false, [], ['Dados do cartão de crédito são obrigatórios'], null);
        }

        paymentData.creditCard = data.creditCard;
        paymentData.creditCardHolderInfo = data.creditCardHolderInfo;
        paymentData.remoteIp = data.remoteIp || '127.0.0.1';
      }

      const asaasPayment = await this.createAsaasPayment(paymentData);

      if (!asaasPayment.success) {
        return new Output(false, [], [asaasPayment.error || 'Erro ao criar pagamento'], null);
      }

      // Para cartão de crédito, verificar se foi aprovado imediatamente
      if (data.paymentMethod === 'CREDIT_CARD') {
        const isApproved = asaasPayment.status === 'CONFIRMED' || asaasPayment.status === 'RECEIVED';
        
        if (isApproved) {
          console.info('💳 [createOperatorPayment] Cartão aprovado imediatamente, criando usuário...');
          
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
              ['Pagamento aprovado mas falha ao criar usuário. Contate o suporte.'],
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

          console.info('✅ [createOperatorPayment] Usuário criado com sucesso:', profile.id);

          // Retornar sucesso imediato
          const result: SubscriptionUpgradeResult = {
            paymentId: asaasPayment.paymentId,
            paymentStatus: 'CONFIRMED',
            paymentMethod: data.paymentMethod,
            dueDate: asaasPayment.dueDate,
            pixQrCode: undefined,
            pixCopyPaste: undefined,
            operatorCreated: true,
          };

          return new Output(
            true,
            ['Pagamento aprovado! Usuário criado com sucesso.'],
            [],
            result
          );
        } else {
          // Cartão negado
          console.warn('⚠️ [createOperatorPayment] Cartão negado:', asaasPayment.status);
          return new Output(
            false,
            [],
            ['Transação negada. Verifique os dados do cartão e tente novamente.'],
            null
          );
        }
      }

      // 5. Para PIX: Salvar dados temporários do operador no banco (pending)
      const pendingOperator = await prisma.pendingOperator.create({
        data: {
          managerId: manager.id,
          name: data.operatorData.name,
          email: data.operatorData.email,
          role: data.operatorData.role,
          paymentId: asaasPayment.paymentId,
          paymentStatus: 'PENDING',
          paymentMethod: data.paymentMethod,
        }
      });

      console.info('💾 [createOperatorPayment] PendingOperator criado:', pendingOperator.id);

      // 6. Preparar resultado para PIX
      const result: SubscriptionUpgradeResult = {
        paymentId: asaasPayment.paymentId,
        paymentStatus: 'PENDING',
        paymentMethod: data.paymentMethod,
        dueDate: asaasPayment.dueDate,
        pixQrCode: asaasPayment.pixQrCode,
        pixCopyPaste: asaasPayment.pixCopyPaste,
        operatorCreated: false,
      };

      return new Output(
        true,
        ['Pagamento criado com sucesso. Aguardando confirmação.'],
        [],
        result
      );

    } catch (error) {
      console.error('Erro ao criar pagamento do operador:', error);
      return new Output(false, [], ['Erro interno ao processar pagamento'], null);
    }
  }

  /**
   * Confirma pagamento e cria operador
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

      console.info('✅ [confirmPaymentAndCreateOperator] PendingOperator encontrado:', {
        id: pendingOperator.id,
        email: pendingOperator.email,
        name: pendingOperator.name,
        operatorCreated: pendingOperator.operatorCreated
      });

      if (pendingOperator.operatorCreated) {
        console.info('ℹ️ [confirmPaymentAndCreateOperator] Operador já foi criado anteriormente');
        return new Output(false, [], ['Operador já foi criado'], null);
      }

      // 2. Verificar status do pagamento no Asaas
      console.info('🔍 [confirmPaymentAndCreateOperator] Verificando status no Asaas...');
      const paymentStatus = await this.checkAsaasPaymentStatus(paymentId);
      console.info('📊 [confirmPaymentAndCreateOperator] Status Asaas:', paymentStatus);
      
      if (!paymentStatus.success || (paymentStatus.status !== 'CONFIRMED' && paymentStatus.status !== 'RECEIVED')) {
        console.warn('⚠️ [confirmPaymentAndCreateOperator] Pagamento não confirmado. Status:', paymentStatus.status);
        return new Output(false, [], ['Pagamento ainda não foi confirmado'], null);
      }

      // 3. Criar usuário no Supabase Auth
      console.info('👤 [confirmPaymentAndCreateOperator] Criando usuário no Supabase...');
      const supabaseUser = await this.createSupabaseUser(
        pendingOperator.email,
        pendingOperator.name
      );

      console.info('📝 [confirmPaymentAndCreateOperator] Resultado criação Supabase:', {
        success: supabaseUser.success,
        userId: supabaseUser.userId,
        error: supabaseUser.error
      });

      if (!supabaseUser.success) {
        console.error('❌ [confirmPaymentAndCreateOperator] Falha ao criar usuário no Supabase:', supabaseUser.error);
        return new Output(false, [], [supabaseUser.error || 'Erro ao criar usuário'], null);
      }

      // 4. Criar perfil do operador no banco
      console.info('💾 [confirmPaymentAndCreateOperator] Criando perfil do operador no banco...');
      console.info('📋 [confirmPaymentAndCreateOperator] Dados do perfil:', {
        supabaseId: supabaseUser.userId,
        fullName: pendingOperator.name,
        email: pendingOperator.email,
        role: pendingOperator.role,
        managerId: pendingOperator.managerId
      });

      const operator = await prisma.profile.create({
        data: {
          supabaseId: supabaseUser.userId!,
          fullName: pendingOperator.name,
          email: pendingOperator.email,
          role: pendingOperator.role as any,
          managerId: pendingOperator.managerId,
        }
      });

      console.info('✅ [confirmPaymentAndCreateOperator] Perfil criado:', {
        id: operator.id,
        supabaseId: operator.supabaseId,
        fullName: operator.fullName,
        email: operator.email,
        role: operator.role,
        managerId: operator.managerId
      });

      // 5. Atualizar status do operador pendente
      console.info('🔄 [confirmPaymentAndCreateOperator] Atualizando PendingOperator...');
      await prisma.pendingOperator.update({
        where: { id: pendingOperator.id },
        data: {
          operatorCreated: true,
          operatorId: operator.id,
          paymentStatus: 'CONFIRMED',
        }
      });

      // 6. Incrementar contador de operadores no manager
      console.info('📊 [confirmPaymentAndCreateOperator] Incrementando contador do manager...');
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

      console.info('🎉 [confirmPaymentAndCreateOperator] SUCESSO! Operador criado:', result);

      return new Output(
        true,
        ['Pagamento confirmado e operador criado com sucesso!'],
        [],
        result
      );

    } catch (error) {
      console.error('❌ [confirmPaymentAndCreateOperator] ERRO CRÍTICO:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
      return new Output(false, [], ['Erro interno ao criar operador'], null);
    }
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

  private async createAsaasPayment(data: any): Promise<any> {
    try {
      console.info('[Asaas] Criando pagamento com dados:', {
        customer: data.customer,
        billingType: data.billingType,
        value: data.value,
        hasCreditCard: !!data.creditCard,
        hasCreditCardHolderInfo: !!data.creditCardHolderInfo,
      });

      // Conforme doc Asaas: POST /v3/payments
      const payment = await asaasFetch(`${process.env.ASAAS_URL}/api/v3/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      console.info('[Asaas] Pagamento criado com sucesso:', { 
        id: payment.id, 
        status: payment.status,
        billingType: payment.billingType
      });

      // Para cartão de crédito, a captura é imediata
      // Status será CONFIRMED ou RECEIVED se aprovado, ou erro HTTP 400 se negado
      if (data.billingType === 'CREDIT_CARD') {
        console.info('[Asaas] Pagamento com cartão processado:', {
          status: payment.status,
          confirmedDate: payment.confirmedDate,
          creditCardBrand: payment.creditCard?.creditCardBrand,
          creditCardNumber: payment.creditCard?.creditCardNumber
        });

        return {
          success: true,
          paymentId: payment.id,
          dueDate: payment.dueDate,
          status: payment.status,
          creditCardToken: payment.creditCard?.creditCardToken, // Para futuras transações
          pixQrCode: null,
          pixCopyPaste: null,
        };
      }

      // Se for PIX, buscar QR Code
      let pixQrCode = null;
      let pixCopyPaste = null;

      if (data.billingType === 'PIX') {
        try {
          console.info('[Asaas] Buscando QR Code PIX para payment:', payment.id);
          
          const qrCodeData = await asaasFetch(
            `${process.env.ASAAS_URL}/api/v3/payments/${payment.id}/pixQrCode`,
            { method: 'GET' }
          );

          console.info('[Asaas] QR Code obtido:', { 
            hasEncodedImage: !!qrCodeData.encodedImage,
            hasPayload: !!qrCodeData.payload 
          });

          pixQrCode = qrCodeData.encodedImage;
          pixCopyPaste = qrCodeData.payload;
        } catch (error: any) {
          console.error('[Asaas] Erro ao buscar QR Code:', error);
          // Continua mesmo se falhar o QR Code
        }
      }

      return {
        success: true,
        paymentId: payment.id,
        dueDate: payment.dueDate,
        status: payment.status,
        pixQrCode,
        pixCopyPaste,
      };
    } catch (error: any) {
      console.error('[Asaas] Erro ao criar pagamento:', {
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
}

export const subscriptionUpgradeUseCase = new SubscriptionUpgradeUseCase();
