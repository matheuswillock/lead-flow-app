// app/api/services/AsaasSubscriptionService.ts
import { asaasApi, asaasFetch } from '@/lib/asaas';

export interface AsaasSubscription {
  customer: string;              // ID do cliente Asaas
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  value: number;                 // Valor da assinatura (59.90 ou 19.90)
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;          // Descrição da assinatura
  externalReference?: string;    // ID do Profile
  nextDueDate?: string;          // Data da próxima cobrança (YYYY-MM-DD)
  creditCardToken?: string;      // Token do cartão (tokenizacao Asaas)
  creditCard?: {
    creditCardToken?: string;
    creditCardNumber?: string;
    creditCardBrand?: string;
  };
  discount?: {
    value: number;               // Desconto em reais
    dueDateLimitDays: number;    // Dias antes do vencimento
    type?: 'FIXED' | 'PERCENTAGE';
  };
  fine?: {
    value: number;               // Multa percentual (%)
    type?: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;               // Juros ao mês (%)
    type?: 'PERCENTAGE';
  };
  endDate?: string;              // Data de término da assinatura
  maxPayments?: number;          // Número máximo de cobranças
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  cycle: string;
  description?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
  nextDueDate: string;
  externalReference?: string;
  dateCreated: string;
  creditCard?: {
    creditCardToken?: string;
    creditCardNumber?: string;
    creditCardBrand?: string;
  };
}

import type { IAsaasSubscriptionService } from './IAsaasSubscriptionService';

export class AsaasSubscriptionService implements IAsaasSubscriptionService {
  createManagerSubscription: IAsaasSubscriptionService['createManagerSubscription'] = AsaasSubscriptionService.createManagerSubscription;
  createOperatorSubscription: IAsaasSubscriptionService['createOperatorSubscription'] = AsaasSubscriptionService.createOperatorSubscription;
  createSubscription: IAsaasSubscriptionService['createSubscription'] = AsaasSubscriptionService.createSubscription;
  getSubscription: IAsaasSubscriptionService['getSubscription'] = AsaasSubscriptionService.getSubscription;
  listSubscriptions: IAsaasSubscriptionService['listSubscriptions'] = AsaasSubscriptionService.listSubscriptions;
  updateSubscription: IAsaasSubscriptionService['updateSubscription'] = AsaasSubscriptionService.updateSubscription;
  cancelSubscription: IAsaasSubscriptionService['cancelSubscription'] = AsaasSubscriptionService.cancelSubscription;
  reactivateSubscription: IAsaasSubscriptionService['reactivateSubscription'] = AsaasSubscriptionService.reactivateSubscription;
  getSubscriptionPayments: IAsaasSubscriptionService['getSubscriptionPayments'] = AsaasSubscriptionService.getSubscriptionPayments;
  updateNextDueDate: IAsaasSubscriptionService['updateNextDueDate'] = AsaasSubscriptionService.updateNextDueDate;
  updateBillingType: IAsaasSubscriptionService['updateBillingType'] = AsaasSubscriptionService.updateBillingType;
  getPixQrCode: IAsaasSubscriptionService['getPixQrCode'] = AsaasSubscriptionService.getPixQrCode;
  getBoletoIdentificationField: IAsaasSubscriptionService['getBoletoIdentificationField'] = AsaasSubscriptionService.getBoletoIdentificationField;
  /**
   * Cria assinatura base do Manager (R$ 59,90/mês)
   */
  static async createManagerSubscription(data: AsaasSubscription) {
    try {
      const subscription = await asaasFetch(asaasApi.subscriptions, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          value: 59.90, // Valor fixo da assinatura base
          cycle: 'MONTHLY',
        }),
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        data: subscription as AsaasSubscriptionResponse,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar assinatura Manager:', error);
      throw new Error(error.message || 'Erro ao criar assinatura');
    }
  }

  /**
   * Cria assinatura de Operador (R$ 19,90/mês)
   */
  static async createOperatorSubscription(data: AsaasSubscription) {
    try {
      const subscription = await asaasFetch(asaasApi.subscriptions, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          value: 19.90, // Valor fixo do operador
          cycle: 'MONTHLY',
        }),
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        data: subscription as AsaasSubscriptionResponse,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar assinatura Operador:', error);
      throw new Error(error.message || 'Erro ao criar assinatura de operador');
    }
  }

  /**
   * Cria assinatura genérica (valor customizado)
   */
  static async createSubscription(data: AsaasSubscription) {
    try {
      const subscription = await asaasFetch(asaasApi.subscriptions, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        data: subscription as AsaasSubscriptionResponse,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar assinatura:', error);
      throw new Error(error.message || 'Erro ao criar assinatura');
    }
  }

  /**
   * Busca assinatura por ID
   */
  static async getSubscription(subscriptionId: string): Promise<AsaasSubscriptionResponse> {
    try {
      return await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
        method: 'GET',
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar assinatura:', error);
      throw new Error('Assinatura não encontrada');
    }
  }

  /**
   * Lista assinaturas de um cliente
   */
  static async listSubscriptions(
    customerId: string,
    params?: {
      status?: 'ACTIVE' | 'EXPIRED' | 'INACTIVE';
      offset?: number;
      limit?: number;
    }
  ) {
    try {
      const queryParams = new URLSearchParams({
        customer: customerId,
      });

      if (params?.status) queryParams.append('status', params.status);
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const result = await asaasFetch(
        `${asaasApi.subscriptions}?${queryParams.toString()}`,
        { method: 'GET' }
      );

      return result.data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar assinaturas:', error);
      return [];
    }
  }

  /**
   * Atualiza assinatura (alterar forma de pagamento, valor, etc)
   */
  static async updateSubscription(
    subscriptionId: string,
    data: Partial<AsaasSubscription>
  ): Promise<AsaasSubscriptionResponse> {
    try {
      return await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar assinatura:', error);
      throw new Error(error.message || 'Erro ao atualizar assinatura');
    }
  }

  /**
   * Cancela assinatura
   */
  static async cancelSubscription(subscriptionId: string): Promise<{ deleted: boolean }> {
    try {
      const result = await asaasFetch(`${asaasApi.subscriptions}/${subscriptionId}`, {
        method: 'DELETE',
      });
      return result;
    } catch (error: any) {
      console.error('❌ Erro ao cancelar assinatura:', error);
      throw new Error('Erro ao cancelar assinatura');
    }
  }

  /**
   * Reativa assinatura cancelada
   */
  static async reactivateSubscription(subscriptionId: string): Promise<AsaasSubscriptionResponse> {
    try {
      return await asaasFetch(
        `${asaasApi.subscriptions}/${subscriptionId}/restore`,
        { method: 'POST' }
      );
    } catch (error: any) {
      console.error('❌ Erro ao reativar assinatura:', error);
      throw new Error('Erro ao reativar assinatura');
    }
  }

  /**
   * Obtém cobranças (payments) de uma assinatura
   */
  static async getSubscriptionPayments(
    subscriptionId: string,
    params?: {
      offset?: number;
      limit?: number;
      status?: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH';
    }
  ) {
    try {
      const queryParams = new URLSearchParams({
        subscription: subscriptionId,
      });

      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.status) queryParams.append('status', params.status);

      const result = await asaasFetch(
        `${asaasApi.payments}?${queryParams.toString()}`,
        { method: 'GET' }
      );

      return result.data || [];
    } catch (error: any) {
      console.error('❌ Erro ao buscar cobranças da assinatura:', error);
      return [];
    }
  }

  /**
   * Atualiza a próxima data de vencimento
   */
  static async updateNextDueDate(
    subscriptionId: string,
    nextDueDate: string
  ): Promise<AsaasSubscriptionResponse> {
    try {
      return await this.updateSubscription(subscriptionId, { nextDueDate });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar próxima data de vencimento:', error);
      throw new Error('Erro ao atualizar data de vencimento');
    }
  }

  /**
   * Altera forma de pagamento da assinatura
   */
  static async updateBillingType(
    subscriptionId: string,
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
  ): Promise<AsaasSubscriptionResponse> {
    try {
      return await this.updateSubscription(subscriptionId, { billingType });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar forma de pagamento:', error);
      throw new Error('Erro ao atualizar forma de pagamento');
    }
  }

  /**
   * PIX: Obter QR Code (imagem base64 e payload copia-e-cola) para um payment
   * Observação: para assinaturas, o Asaas cria o primeiro payment agendado. Busque o paymentId e chame este método.
   */
  static async getPixQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
    try {
      const data = await asaasFetch(asaasApi.pixQrCode(paymentId), { method: 'GET' })
      return { 
        encodedImage: data?.encodedImage, 
        payload: data?.payload,
        expirationDate: data?.expirationDate
      }
    } catch (error: any) {
      console.error('Erro ao obter QR Code PIX:', error)
      throw new Error('Erro ao obter QR Code PIX')
    }
  }

  /**
   * BOLETO: Obter linha digitável e código de barras para um payment
   */
  static async getBoletoIdentificationField(paymentId: string): Promise<{ identificationField: string; nossoNumero: string; barCode: string }> {
    try {
      const data = await asaasFetch(`${asaasApi.payments}/${paymentId}/identificationField`, { method: 'GET' })
      
      console.info('📄 [AsaasSubscriptionService] Resposta completa da API do boleto:', JSON.stringify(data, null, 2));
      console.info('📄 [AsaasSubscriptionService] identificationField recebido:', data?.identificationField);
      console.info('📄 [AsaasSubscriptionService] barCode recebido:', data?.barCode);
      console.info('📄 [AsaasSubscriptionService] nossoNumero recebido:', data?.nossoNumero);
      
      return { 
        identificationField: data?.identificationField, 
        nossoNumero: data?.nossoNumero,
        barCode: data?.barCode
      }
    } catch (error: any) {
      console.error('Erro ao obter linha digitável do boleto:', error)
      throw new Error('Erro ao obter linha digitável do boleto')
    }
  }
}

export const asaasSubscriptionService = new AsaasSubscriptionService();
