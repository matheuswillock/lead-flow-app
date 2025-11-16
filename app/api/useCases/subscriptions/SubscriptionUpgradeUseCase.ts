import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { asaasFetch } from "@/lib/asaas";
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
        return new Output(false, [], ['Apenas managers podem adicionar operadores'], null);
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

      // 4. Criar cobrança no Asaas (R$ 20,00 por operador adicional)
      const operatorPrice = 20.00;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // 7 dias para pagamento

      const asaasPayment = await this.createAsaasPayment({
        customer: manager.asaasCustomerId,
        billingType: data.paymentMethod,
        value: operatorPrice,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `Adição de operador: ${data.operatorData.name}`,
        externalReference: `operator-${manager.id}-${Date.now()}`,
      });

      if (!asaasPayment.success) {
        return new Output(false, [], [asaasPayment.error || 'Erro ao criar pagamento'], null);
      }

      // 5. Salvar dados temporários do operador no banco (pending)
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

      // 6. Preparar resultado
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
      // 1. Buscar operador pendente
      const pendingOperator = await prisma.pendingOperator.findUnique({
        where: { paymentId },
        include: {
          manager: true
        }
      });

      if (!pendingOperator) {
        return new Output(false, [], ['Pagamento não encontrado'], null);
      }

      if (pendingOperator.operatorCreated) {
        return new Output(false, [], ['Operador já foi criado'], null);
      }

      // 2. Verificar status do pagamento no Asaas
      const paymentStatus = await this.checkAsaasPaymentStatus(paymentId);
      
      if (!paymentStatus.success || paymentStatus.status !== 'CONFIRMED') {
        return new Output(false, [], ['Pagamento ainda não foi confirmado'], null);
      }

      // 3. Criar usuário no Supabase Auth
      const supabaseUser = await this.createSupabaseUser(
        pendingOperator.email,
        pendingOperator.name
      );

      if (!supabaseUser.success) {
        return new Output(false, [], [supabaseUser.error || 'Erro ao criar usuário'], null);
      }

      // 4. Criar perfil do operador no banco
      const operator = await prisma.profile.create({
        data: {
          supabaseId: supabaseUser.userId!,
          fullName: pendingOperator.name,
          email: pendingOperator.email,
          role: pendingOperator.role as any,
          managerId: pendingOperator.managerId,
        }
      });

      // 5. Atualizar status do operador pendente
      await prisma.pendingOperator.update({
        where: { id: pendingOperator.id },
        data: {
          operatorCreated: true,
          operatorId: operator.id,
          paymentStatus: 'CONFIRMED',
        }
      });

      // 6. Incrementar contador de operadores no manager
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

      return new Output(
        true,
        ['Pagamento confirmado e operador criado com sucesso!'],
        [],
        result
      );

    } catch (error) {
      console.error('Erro ao confirmar pagamento e criar operador:', error);
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
      console.info('[Asaas] Criando pagamento com dados:', data);

      const payment = await asaasFetch(`${process.env.ASAAS_URL}/api/v3/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      console.info('[Asaas] Pagamento criado com sucesso:', { 
        id: payment.id, 
        status: payment.status 
      });

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
        pixQrCode,
        pixCopyPaste,
      };
    } catch (error: any) {
      console.error('[Asaas] Erro ao criar pagamento:', error);
      return { 
        success: false, 
        error: error.message || 'Erro ao comunicar com gateway de pagamento' 
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
      // Implementação com Supabase Admin API
      // Por enquanto, retorna mock (você deve implementar com createSupabaseServer)
      const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
      
      // TODO: Implementar criação real no Supabase
      // const { data, error } = await supabase.auth.admin.createUser({
      //   email,
      //   password: randomPassword,
      //   email_confirm: true,
      //   user_metadata: { name }
      // });

      return {
        success: true,
        userId: `temp-${Date.now()}`, // Mock - substituir por ID real do Supabase
        temporaryPassword: randomPassword,
      };
    } catch (error) {
      return { success: false, error: 'Erro ao criar usuário no sistema de autenticação' };
    }
  }
}

export const subscriptionUpgradeUseCase = new SubscriptionUpgradeUseCase();
