import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasFetch, asaasApi } from "@/lib/asaas";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService";
import { AsaasCustomerService } from "@/app/api/services/AsaasCustomer/AsaasCustomerService";
import { getEmailService } from "@/lib/services/EmailService";
import { getFullUrl } from '@/lib/utils/app-url';
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

      // 2. Verificar se email do operador já existe
      const existingUser = await prisma.profile.findFirst({
        where: { 
          email: data.operatorData.email
        }
      });

      if (existingUser) {
        return new Output(false, [], ['Email já está em uso'], null);
      }

      // 3. Salvar dados temporários do operador no banco (pending)
      const pendingOperator = await prisma.pendingOperator.create({
        data: {
          managerId: manager.id,
          name: data.operatorData.name,
          email: data.operatorData.email,
          role: data.operatorData.role,
          paymentId: 'pending', // Será atualizado após criação do checkout
          subscriptionId: null,
          paymentStatus: 'PENDING',
          paymentMethod: data.paymentMethod,
        }
      });

      console.info('💾 [createOperatorPayment] PendingOperator criado:', pendingOperator.id);

      // 4. Validar ou criar customer no Asaas
      let asaasCustomerId = manager.asaasCustomerId;
      
      if (!asaasCustomerId) {
        console.error('❌ [createOperatorPayment] Manager sem asaasCustomerId:', {
          managerId: manager.id,
          managerEmail: manager.email
        });
        
        // Deletar pendingOperator
        await prisma.pendingOperator.delete({
          where: { id: pendingOperator.id }
        });
        
        return new Output(
          false, 
          [], 
          ['Erro: Sua conta não possui customer Asaas. Por favor, entre em contato com o suporte.'], 
          null
        );
      }

      // Verificar se o customer existe no Asaas atual (pode ter mudado de sandbox para produção)
      console.info('🔍 [createOperatorPayment] Verificando customer no Asaas:', asaasCustomerId);
      try {
        await AsaasCustomerService.getCustomer(asaasCustomerId);
        console.info('✅ [createOperatorPayment] Customer válido no ambiente atual');
      } catch (error: any) {
        console.warn('⚠️ [createOperatorPayment] Customer não encontrado no ambiente atual:', {
          asaasCustomerId,
          error: error.message
        });
        
        // Customer não existe neste ambiente - criar novo
        console.info('🔄 [createOperatorPayment] Criando novo customer no ambiente atual...');
        
        // Construir dados do customer com campos opcionais
        const customerData: any = {
          name: manager.fullName || manager.email,
          email: manager.email,
          cpfCnpj: manager.cpfCnpj || '00000000000', // CPF genérico se não tiver
          externalReference: manager.id,
        };
        
        if (manager.phone) customerData.phone = manager.phone;
        if (manager.postalCode) customerData.postalCode = manager.postalCode;
        if (manager.address) customerData.address = manager.address;
        if (manager.addressNumber) customerData.addressNumber = manager.addressNumber;
        if (manager.complement) customerData.complement = manager.complement;
        
        const newCustomer = await AsaasCustomerService.createCustomer(customerData);
        
        if (!newCustomer || !newCustomer.success || !newCustomer.customerId) {
          console.error('❌ [createOperatorPayment] Falha ao criar customer');
          await prisma.pendingOperator.delete({
            where: { id: pendingOperator.id }
          });
          return new Output(false, [], ['Erro ao criar customer no gateway'], null);
        }
        
        // Atualizar profile com novo customerId
        await prisma.profile.update({
          where: { id: manager.id },
          data: { asaasCustomerId: newCustomer.customerId }
        });
        
        asaasCustomerId = newCustomer.customerId;
        console.info('✅ [createOperatorPayment] Novo customer criado:', asaasCustomerId);
      }

      // Garantir que temos um customerId válido neste ponto
      if (!asaasCustomerId) {
        console.error('❌ [createOperatorPayment] asaasCustomerId é null após validações');
        await prisma.pendingOperator.delete({
          where: { id: pendingOperator.id }
        });
        return new Output(false, [], ['Erro: Customer ID inválido'], null);
      }

      // 5. Gerar link de checkout hospedado do Asaas
      const checkoutLink = await this.createAsaasCheckoutLink({
        customer: asaasCustomerId,
        value: 19.90,
        description: `Licença adicional de operador - ${data.operatorData.name} (${data.operatorData.email}) - Acesso completo à plataforma Corretor Studio com gestão de leads, pipeline de vendas e métricas em tempo real`,
        pendingOperatorId: pendingOperator.id,
        managerId: manager.supabaseId || manager.id,
        operatorName: data.operatorData.name,
        operatorEmail: data.operatorData.email,
      });

      if (!checkoutLink.success) {
        // Deletar pendingOperator se falhar
        await prisma.pendingOperator.delete({
          where: { id: pendingOperator.id }
        });
        return new Output(false, [], [checkoutLink.error || 'Erro ao criar checkout'], null);
      }

      console.info('✅ [createOperatorPayment] Checkout link criado:', checkoutLink.checkoutUrl);

      // 5. Retornar link de checkout
      return new Output(
        true,
        ['Checkout criado com sucesso'],
        [],
        {
          checkoutUrl: checkoutLink.checkoutUrl,
          pendingOperatorId: pendingOperator.id,
        }
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
      console.info('🔄 [confirmPaymentAndCreateOperator] ============================================');
      console.info('🔄 [confirmPaymentAndCreateOperator] Iniciando processamento para paymentId:', paymentId);

      // 1. Buscar operador pendente por paymentId (usando findFirst pois não é unique)
      let pendingOperator = await prisma.pendingOperator.findFirst({
        where: { paymentId },
        include: {
          manager: true
        }
      });

      console.info('🔍 [confirmPaymentAndCreateOperator] Resultado busca por paymentId:', {
        found: !!pendingOperator,
        id: pendingOperator?.id || 'não encontrado',
        email: pendingOperator?.email || 'não encontrado'
      });

      // 2. Se não encontrou por paymentId, buscar pelo externalReference do Asaas
      if (!pendingOperator) {
        console.info('ℹ️ [confirmPaymentAndCreateOperator] Não encontrado por paymentId, verificando no Asaas...');
        
        const paymentStatus = await this.checkAsaasPaymentStatus(paymentId);
        
        if (paymentStatus.success && paymentStatus.externalReference) {
          const externalRef = paymentStatus.externalReference;
          console.info('🔍 [confirmPaymentAndCreateOperator] ExternalReference encontrado:', externalRef);
          
          // Extrair ID do externalReference (formato: pending-operator-{uuid})
          if (externalRef.startsWith('pending-operator-')) {
            const pendingOperatorId = externalRef.replace('pending-operator-', '');
            console.info('🆔 [confirmPaymentAndCreateOperator] Buscando por ID:', pendingOperatorId);
            
            pendingOperator = await prisma.pendingOperator.findUnique({
              where: { id: pendingOperatorId },
              include: { manager: true }
            });
            
            // Atualizar paymentId no PendingOperator
            if (pendingOperator) {
              console.info('✅ [confirmPaymentAndCreateOperator] PendingOperator encontrado por externalReference');
              await prisma.pendingOperator.update({
                where: { id: pendingOperatorId },
                data: { paymentId }
              });
            }
          }
        }
      }

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
    console.info('🎯 [createOperatorFromPending] ============================================');
    console.info('🎯 [createOperatorFromPending] INICIANDO CRIAÇÃO DE OPERADOR');
    console.info('📋 [createOperatorFromPending] Dados de entrada:', {
      pendingOperatorId: pendingOperator.id,
      email: pendingOperator.email,
      name: pendingOperator.name,
      operatorCreated: pendingOperator.operatorCreated,
      managerId: pendingOperator.managerId,
      paymentId: paymentId,
      currentPaymentIdInDB: pendingOperator.paymentId,
      paymentStatus: pendingOperator.paymentStatus
    });

    try {
      if (pendingOperator.operatorCreated) {
        console.info('ℹ️ [createOperatorFromPending] Operador já foi criado anteriormente');
        return new Output(false, [], ['Operador já foi criado'], null);
      }

      // 2. Verificar status do pagamento no Asaas
      console.info('🔍 [createOperatorFromPending] Verificando status no Asaas...');
      let paymentStatus;
      try {
        paymentStatus = await this.checkAsaasPaymentStatus(paymentId);
        console.info('📊 [createOperatorFromPending] Status Asaas:', paymentStatus);
      } catch (error) {
        console.error('❌ [createOperatorFromPending] Erro ao verificar status no Asaas:', error);
        return new Output(false, [], ['Erro ao verificar status do pagamento'], null);
      }
      
      if (!paymentStatus.success || (paymentStatus.status !== 'CONFIRMED' && paymentStatus.status !== 'RECEIVED')) {
        console.warn('⚠️ [createOperatorFromPending] Pagamento não confirmado. Status:', paymentStatus.status);
        return new Output(false, [], ['Pagamento ainda não foi confirmado'], null);
      }

      // 3. Criar usuário no Supabase Auth
      console.info('👤 [createOperatorFromPending] Criando usuário no Supabase...');
      console.info('📋 [createOperatorFromPending] Dados do usuário:', {
        email: pendingOperator.email,
        name: pendingOperator.name
      });
      
      let supabaseUser;
      try {
        supabaseUser = await this.createSupabaseUser(
          pendingOperator.email,
          pendingOperator.name,
          pendingOperator.role,
          pendingOperator.manager.fullName
        );

        console.info('📝 [createOperatorFromPending] Resultado criação Supabase:', {
          success: supabaseUser.success,
          userId: supabaseUser.userId,
          error: supabaseUser.error
        });
      } catch (error) {
        console.error('❌ [createOperatorFromPending] Erro ao criar usuário no Supabase:', error);
        return new Output(false, [], ['Erro ao criar usuário no sistema de autenticação'], null);
      }

      if (!supabaseUser.success || !supabaseUser.userId) {
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

      // 5. CRÍTICO: Atualizar valor da assinatura do master no Asaas ANTES de criar operador
      console.info('💰 [createOperatorFromPending] Atualizando valor da assinatura do master...');
      console.info('👤 [createOperatorFromPending] Manager ID tentando atualizar:', pendingOperator.managerId);
      
      try {
        const manager = await prisma.profile.findUnique({
          where: { id: pendingOperator.managerId }
        });

        if (!manager) {
          console.error('❌ [createOperatorFromPending] Manager não encontrado:', pendingOperator.managerId);
          return new Output(
            false, 
            [], 
            ['Erro: Usuário master não encontrado para atualizar assinatura'], 
            null
          );
        }

        console.info('👤 [createOperatorFromPending] Manager encontrado:', {
          id: manager.id,
          supabaseId: manager.supabaseId,
          fullName: manager.fullName,
          asaasSubscriptionId: manager.asaasSubscriptionId
        });

        if (!manager.asaasSubscriptionId) {
          console.error('❌ [createOperatorFromPending] Manager não possui assinatura Asaas:', {
            managerId: manager.id,
            managerName: manager.fullName,
            operadorTentandoAdicionar: pendingOperator.name
          });
          return new Output(
            false,
            [],
            ['Erro: Assinatura do usuário master não encontrada. Não é possível adicionar operador.'],
            null
          );
        }

        // Buscar assinatura atual no Asaas
        console.info('🔍 [createOperatorFromPending] Buscando assinatura atual no Asaas...');
        const currentSubscription = await AsaasSubscriptionService.getSubscription(manager.asaasSubscriptionId);
        
        if (!currentSubscription) {
          console.error('❌ [createOperatorFromPending] Assinatura não encontrada no Asaas:', {
            managerId: manager.id,
            asaasSubscriptionId: manager.asaasSubscriptionId,
            operadorTentandoAdicionar: pendingOperator.name
          });
          return new Output(
            false,
            [],
            ['Erro: Não foi possível localizar a assinatura no gateway de pagamento'],
            null
          );
        }

        // Calcular novo valor (atual + R$ 19,90 do novo operador)
        const newValue = currentSubscription.value + 19.90;
        
        console.info('💵 [createOperatorFromPending] Detalhes da atualização:', {
          managerId: manager.id,
          managerName: manager.fullName,
          supabaseId: manager.supabaseId,
          asaasSubscriptionId: manager.asaasSubscriptionId,
          valorAnterior: currentSubscription.value,
          valorNovo: newValue,
          operadorAdicionado: pendingOperator.name,
          tipoPagamento: currentSubscription.billingType
        });

        // Atualizar assinatura (comportamento diferente por tipo de pagamento)
        if (currentSubscription.billingType === 'CREDIT_CARD') {
          console.info('💳 [createOperatorFromPending] Atualizando assinatura com cobrança automática (Cartão)...');
          await AsaasSubscriptionService.updateSubscription(
            manager.asaasSubscriptionId,
            { value: newValue }
          );
          console.info('✅ [createOperatorFromPending] Assinatura atualizada com cobrança automática no cartão');
        } else {
          console.info('📄 [createOperatorFromPending] Atualizando assinatura para próxima cobrança (PIX/Boleto)...');
          await AsaasSubscriptionService.updateSubscription(
            manager.asaasSubscriptionId,
            { value: newValue }
          );
          console.info('✅ [createOperatorFromPending] Assinatura atualizada - novo valor será cobrado na próxima fatura');
        }

        console.info('🎉 [createOperatorFromPending] Assinatura atualizada com sucesso! Prosseguindo com criação do operador...');

      } catch (error) {
        console.error('❌ [createOperatorFromPending] ERRO CRÍTICO ao atualizar assinatura:', error);
        console.error('👤 [createOperatorFromPending] Manager que tentou atualizar:', {
          managerId: pendingOperator.managerId,
          operadorTentandoAdicionar: pendingOperator.name,
          operadorEmail: pendingOperator.email
        });
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        
        return new Output(
          false,
          [],
          ['Erro ao atualizar assinatura. O operador não pode ser criado sem atualizar a cobrança.'],
          null
        );
      }

      // 6. Criar operador no banco (só chega aqui se assinatura foi atualizada)
      let operator;
      try {
        operator = await prisma.profile.create({
          data: {
            supabaseId: supabaseUser.userId,
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
      } catch (error) {
        console.error('❌ [createOperatorFromPending] Erro ao criar perfil no banco:', error);
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        return new Output(false, [], ['Erro ao criar perfil do operador'], null);
      }

      // 7. Atualizar status do operador pendente (CRÍTICO - deve ser bem-sucedido)
      console.info('🔄 [createOperatorFromPending] Atualizando PendingOperator...');
      try {
        const updated = await prisma.pendingOperator.update({
          where: { id: pendingOperator.id },
          data: {
            operatorCreated: true,
            operatorId: operator.id,
            paymentStatus: 'CONFIRMED',
            updatedAt: new Date()
          }
        });
        console.info('✅ [createOperatorFromPending] PendingOperator atualizado com sucesso:', {
          id: updated.id,
          operatorCreated: updated.operatorCreated,
          operatorId: updated.operatorId,
          paymentStatus: updated.paymentStatus
        });
      } catch (error) {
        console.error('❌ [createOperatorFromPending] ERRO CRÍTICO ao atualizar PendingOperator:', error);
        console.error('⚠️ [createOperatorFromPending] ATENÇÃO: Operador foi criado mas PendingOperator não foi marcado como criado!');
        console.error('🔧 [createOperatorFromPending] Dados para debug:', {
          pendingOperatorId: pendingOperator.id,
          operatorId: operator.id,
          errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
        });
        // Não retorna erro pois o operador já foi criado, mas loga claramente o problema
      }

      // 8. Incrementar contador de operadores no manager
      console.info('📊 [createOperatorFromPending] Incrementando contador do manager...');
      try {
        await prisma.profile.update({
          where: { id: pendingOperator.managerId },
          data: {
            operatorCount: {
              increment: 1
            }
          }
        });
        console.info('✅ [createOperatorFromPending] Contador do manager incrementado');
      } catch (error) {
        console.error('❌ [createOperatorFromPending] Erro ao incrementar contador:', error);
        // Não retorna erro pois o operador já foi criado
      }

      // Nota: A exclusão do PendingOperator é feita pelo webhook do Asaas após confirmação

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
    } catch (error) {
      console.error('❌ [createOperatorFromPending] ERRO CRÍTICO NÃO TRATADO:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
      console.error('PendingOperator:', {
        id: pendingOperator.id,
        email: pendingOperator.email,
        managerId: pendingOperator.managerId
      });
      return new Output(false, [], ['Erro crítico ao processar operador'], null);
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

  /**
   * Cria link de checkout hospedado no Asaas
   */
  private async createAsaasCheckoutLink(data: {
    customer: string;
    value: number;
    description: string;
    pendingOperatorId: string;
    managerId: string;
    operatorName: string;
    operatorEmail: string;
  }): Promise<any> {
    try {
      console.info('[Asaas] Criando checkout link com dados:', {
        customer: data.customer,
        value: data.value,
        description: data.description,
      });

      // Criar checkout HOSPEDADO (permite escolher forma de pagamento)
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + 1); // 1 mês de prazo
      
      // Primeiro cria o payment como PIX (default)
      const paymentPayload = {
        customer: data.customer,
        billingType: 'PIX', // PIX como padrão, mas checkout permite alterar
        value: data.value,
        dueDate: nextDueDate.toISOString().split('T')[0],
        description: data.description,
        externalReference: `pending-operator-${data.pendingOperatorId}`,
      };

      // Criar payment no Asaas
      const payment = await asaasFetch(asaasApi.payments, {
        method: 'POST',
        body: JSON.stringify(paymentPayload),
      });

      console.info('[Asaas] Payment criado:', {
        id: payment.id,
        status: payment.status,
        invoiceUrl: payment.invoiceUrl,
      });

      // Atualizar pendingOperator com paymentId
      await prisma.pendingOperator.update({
        where: { id: data.pendingOperatorId },
        data: { paymentId: payment.id },
      });

      // Retornar URL do checkout
      return {
        success: true,
        checkoutUrl: payment.invoiceUrl, // URL do checkout hospedado
        paymentId: payment.id,
      };
    } catch (error: any) {
      console.error('[Asaas] Erro ao criar checkout link:', {
        message: error.message,
        response: error.response,
        status: error.status,
      });

      let errorMessage = 'Erro ao criar checkout';

      if (error.response?.errors && Array.isArray(error.response.errors)) {
        errorMessage = error.response.errors
          .map((e: any) => e.description || e.message)
          .join(', ');
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

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
      const subscription = await asaasFetch(asaasApi.subscriptions, {
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
      const payment = await asaasFetch(`${asaasApi.payments}/${paymentId}`, {
        method: 'GET',
      });

      return {
        success: true,
        status: payment.status,
        externalReference: payment.externalReference,
        value: payment.value,
        billingType: payment.billingType,
      };
    } catch (error: any) {
      console.error('[Asaas] Erro ao verificar status:', error);
      return { success: false };
    }
  }

  private async createSupabaseUser(email: string, name: string, role: string, managerName: string): Promise<any> {
    try {
      console.info('🔐 [createSupabaseUser] Iniciando criação de usuário:', { email, name, role });

      // Criar cliente Supabase Admin (Service Role)
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error('❌ [createSupabaseUser] Falha ao criar cliente Supabase Admin');
        return { success: false, error: 'Falha ao conectar com sistema de autenticação' };
      }

      console.info('✅ [createSupabaseUser] Cliente Supabase Admin criado');

      // Gerar link de convite SEM enviar e-mail do Supabase
      const redirectTo = getFullUrl('/set-password');
      console.info('🔗 [createSupabaseUser] Gerando link de convite para:', email);
      console.info('🔗 [createSupabaseUser] Redirect URL:', redirectTo);

      // Usar generateLink ao invés de inviteUserByEmail para não enviar e-mail do Supabase
      const { data, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: email,
        options: {
          redirectTo,
          data: { 
            name,
            invited: true,
            first_access: true 
          }
        }
      });

      if (linkError || !data.properties?.action_link) {
        console.error('❌ [createSupabaseUser] Erro ao gerar link de convite:', linkError);
        return { 
          success: false, 
          error: linkError?.message || 'Erro ao gerar link de convite' 
        };
      }

      const inviteLink = data.properties.action_link;
      const userId = data.user.id;

      console.info('✅ [createSupabaseUser] Link de convite gerado com sucesso:', {
        userId,
        email: data.user.email
      });

      // Enviar e-mail personalizado APENAS via Resend
      try {
        const emailService = getEmailService();
        await emailService.sendOperatorInviteEmail({
          operatorName: name,
          operatorEmail: email,
          operatorRole: role,
          managerName: managerName,
          inviteUrl: inviteLink, // Usar o link gerado pelo Supabase
        });
        console.info('✅ [createSupabaseUser] E-mail enviado via Resend com sucesso');
      } catch (emailError) {
        console.error('❌ [createSupabaseUser] Erro ao enviar e-mail via Resend:', emailError);
        return {
          success: false,
          error: 'Erro ao enviar e-mail de convite'
        };
      }

      return {
        success: true,
        userId: userId,
        invited: true,
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
        fullName: manager.fullName,
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
      
      // Se a data já passou, adicionar 1 mês
      if (nextDueDate < new Date()) {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
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

      if (!newSubscription || !newSubscription.data?.id) {
        return new Output(false, [], ['Erro ao criar nova assinatura no Asaas'], null);
      }

      console.info('✅ [reactivateSubscription] Nova assinatura criada:', {
        subscriptionId: newSubscription.data.id,
        value: newSubscription.data.value,
        status: newSubscription.data.status
      });

      // 6. Atualizar Profile no banco
      await prisma.profile.update({
        where: { id: manager.id },
        data: {
          asaasSubscriptionId: newSubscription.data.id,
          subscriptionNextDueDate: nextDueDate,
          subscriptionCycle: 'MONTHLY',
          operatorCount: data.operatorCount,
          updatedAt: new Date()
        }
      });

      console.info('✅ [reactivateSubscription] Profile atualizado no banco');

      // 7. Preparar resposta com dados PIX se necessário
      const resultData: any = {
        subscriptionId: newSubscription.data.id,
        status: newSubscription.data.status,
        value: newSubscription.data.value,
        nextDueDate: nextDueDateStr,
        operatorCount: data.operatorCount
      };

      // Se for PIX, buscar dados da primeira cobrança
      if (data.paymentMethod === 'PIX') {
        try {
          // Buscar primeira cobrança da assinatura
          const payments = await asaasFetch(`${asaasApi.subscriptions}/${newSubscription.data.id}/payments`, {
            method: 'GET',
          });
          if (payments.data && payments.data.length > 0) {
            const firstPayment = payments.data[0];
            resultData.paymentId = firstPayment.id;
            
            // Se tiver QR code do PIX
            if (firstPayment.invoiceUrl) {
              const pixData = await asaasFetch(asaasApi.pixQrCode(firstPayment.id), {
                method: 'GET',
              });
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
