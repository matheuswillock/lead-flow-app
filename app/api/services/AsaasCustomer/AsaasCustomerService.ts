// app/api/services/AsaasCustomerService.ts
import {
  asaasApi,
  asaasFetch,
  buildDisableCustomerFacingNotificationPatch,
  type AsaasCustomerNotification,
  type AsaasCustomerNotificationUpdate,
} from '@/lib/asaas';
import { asaasCustomerGateway } from '@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway';

export interface AsaasCustomer {
  name: string;              // Nome completo do Manager
  cpfCnpj: string;          // CPF ou CNPJ (apenas números)
  email: string;            // Email do Manager
  phone?: string;           // Telefone (11987654321)
  mobilePhone?: string;     // Celular
  address?: string;         // Logradouro
  addressNumber?: string;   // Número
  complement?: string;      // Complemento
  province?: string;        // Bairro
  postalCode?: string;      // CEP (apenas números)
  externalReference: string; // ID do Profile no nosso sistema
  /** D8: Asaas não deve notificar o pagador — comunicação via Corretor Studio */
  notificationDisabled?: boolean;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
  notificationDisabled: boolean;
  observations?: string;
  dateCreated: string;
}

import type { IAsaasCustomerService } from './IAsaasCustomerService';

export class AsaasCustomerService implements IAsaasCustomerService {
  createCustomer: IAsaasCustomerService['createCustomer'] = AsaasCustomerService.createCustomer;
  getCustomer: IAsaasCustomerService['getCustomer'] = AsaasCustomerService.getCustomer;
  getCustomerByCpfCnpj: IAsaasCustomerService['getCustomerByCpfCnpj'] = AsaasCustomerService.getCustomerByCpfCnpj;
  listCustomers: IAsaasCustomerService['listCustomers'] = AsaasCustomerService.listCustomers;
  updateCustomer: IAsaasCustomerService['updateCustomer'] = AsaasCustomerService.updateCustomer;
  deleteCustomer: IAsaasCustomerService['deleteCustomer'] = AsaasCustomerService.deleteCustomer;
  restoreCustomer: IAsaasCustomerService['restoreCustomer'] = AsaasCustomerService.restoreCustomer;
  listCustomerNotifications: IAsaasCustomerService['listCustomerNotifications'] =
    AsaasCustomerService.listCustomerNotifications;
  updateCustomerNotification: IAsaasCustomerService['updateCustomerNotification'] =
    AsaasCustomerService.updateCustomerNotification;
  updateCustomerNotificationsBatch: IAsaasCustomerService['updateCustomerNotificationsBatch'] =
    AsaasCustomerService.updateCustomerNotificationsBatch;
  disableCustomerFacingNotifications: IAsaasCustomerService['disableCustomerFacingNotifications'] =
    AsaasCustomerService.disableCustomerFacingNotifications;

  /**
   * Cria um novo cliente Manager no Asaas.
   *
   * Delega para AsaasCustomerGateway (E5 de
   * [[10 — Fundações Multi-conta — Backend]], DA5/M4.8) — nenhum POST
   * /customers monta aqui; `externalReference`/`notificationDisabled` são
   * fixados pelo gateway, não pelo `data.notificationDisabled` que este
   * método aceitava antes (mantido no tipo por compat de chamadores
   * existentes, mas ignorado — o gateway sempre envia silencioso).
   */
  static async createCustomer(data: AsaasCustomer) {
    try {
      console.info('🚀 [AsaasCustomerService] Criando cliente via AsaasCustomerGateway:', {
        name: data.name,
        email: data.email,
        cpfCnpjLength: data.cpfCnpj?.length || 0,
        externalReference: data.externalReference,
      });

      const customer = await asaasCustomerGateway.createCustomer({
        profileId: data.externalReference,
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        phone: data.phone,
        mobilePhone: data.mobilePhone,
        postalCode: data.postalCode,
        address: data.address,
        addressNumber: data.addressNumber,
        complement: data.complement,
        province: data.province,
      });

      return {
        success: true,
        customerId: customer.id,
        data: customer as unknown as AsaasCustomerResponse,
      };
    } catch (error: any) {
      console.error('❌ Erro ao criar cliente Asaas:', error);
      throw new Error(error.message || 'Erro ao criar cliente no Asaas');
    }
  }

  /**
   * Busca cliente por ID
   */
  static async getCustomer(customerId: string): Promise<AsaasCustomerResponse> {
    try {
      return await asaasFetch(`${asaasApi.customers}/${customerId}`, {
        method: 'GET',
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar cliente:', error);
      throw new Error('Cliente não encontrado');
    }
  }

  /**
   * Busca cliente por CPF/CNPJ
   */
  static async getCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomerResponse | null> {
    try {
      const result = await asaasFetch(
        `${asaasApi.customers}?cpfCnpj=${cpfCnpj}`,
        { method: 'GET' }
      );
      return result.data?.[0] || null;
    } catch (error: any) {
      console.error('❌ Erro ao buscar cliente por CPF/CNPJ:', error);
      return null;
    }
  }

  /**
   * Lista todos os clientes (com paginação)
   */
  static async listCustomers(params?: {
    offset?: number;
    limit?: number;
    email?: string;
    name?: string;
  }) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.email) queryParams.append('email', params.email);
      if (params?.name) queryParams.append('name', params.name);

      const result = await asaasFetch(
        `${asaasApi.customers}?${queryParams.toString()}`,
        { method: 'GET' }
      );

      return {
        data: result.data || [],
        hasMore: result.hasMore || false,
        totalCount: result.totalCount || 0,
        limit: result.limit || 10,
        offset: result.offset || 0,
      };
    } catch (error: any) {
      console.error('❌ Erro ao listar clientes:', error);
      throw new Error('Erro ao listar clientes');
    }
  }

  /**
   * Atualiza dados do cliente
   */
  static async updateCustomer(
    customerId: string,
    data: Partial<AsaasCustomer>
  ): Promise<AsaasCustomerResponse> {
    try {
      const payload: Partial<AsaasCustomer> = {
        ...data,
        notificationDisabled: data.notificationDisabled ?? true,
      };
      return await asaasFetch(`${asaasApi.customers}/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar cliente:', error);
      throw new Error(error.message || 'Erro ao atualizar cliente');
    }
  }

  static async listCustomerNotifications(
    customerId: string
  ): Promise<AsaasCustomerNotification[]> {
    try {
      const result = await asaasFetch(asaasApi.customerNotifications(customerId), {
        method: 'GET',
      });
      return Array.isArray(result?.data) ? (result.data as AsaasCustomerNotification[]) : [];
    } catch (error: any) {
      console.error('❌ Erro ao listar notificações do cliente Asaas:', error);
      throw new Error(error.message || 'Erro ao listar notificações do cliente');
    }
  }

  static async updateCustomerNotification(
    notificationId: string,
    data: Omit<AsaasCustomerNotificationUpdate, 'id'>
  ): Promise<AsaasCustomerNotification> {
    try {
      return await asaasFetch(asaasApi.notificationById(notificationId), {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar notificação Asaas:', error);
      throw new Error(error.message || 'Erro ao atualizar notificação');
    }
  }

  static async updateCustomerNotificationsBatch(
    customerId: string,
    notifications: AsaasCustomerNotificationUpdate[]
  ): Promise<AsaasCustomerNotification[]> {
    try {
      const result = await asaasFetch(asaasApi.notificationsBatch, {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          notifications,
        }),
      });
      if (Array.isArray(result?.data)) {
        return result.data as AsaasCustomerNotification[];
      }
      if (Array.isArray(result)) {
        return result as AsaasCustomerNotification[];
      }
      return [];
    } catch (error: any) {
      console.error('❌ Erro ao atualizar notificações Asaas em lote:', error);
      throw new Error(error.message || 'Erro ao atualizar notificações em lote');
    }
  }

  /**
   * Desabilita canais de comunicação com o pagador (D8/D9).
   * Mantém a possibilidade de notificações do provider.
   */
  static async disableCustomerFacingNotifications(customerId: string): Promise<{
    updatedCount: number;
    notifications: AsaasCustomerNotification[];
  }> {
    await AsaasCustomerService.updateCustomer(customerId, {
      notificationDisabled: true,
    });

    const existing = await AsaasCustomerService.listCustomerNotifications(customerId);
    if (existing.length === 0) {
      return { updatedCount: 0, notifications: [] };
    }

    const patch = existing.map((item) => buildDisableCustomerFacingNotificationPatch(item));
    const updated = await AsaasCustomerService.updateCustomerNotificationsBatch(
      customerId,
      patch
    );
    return { updatedCount: patch.length, notifications: updated };
  }

  /**
   * Deleta um cliente (cuidado: remove todas as cobranças associadas)
   */
  static async deleteCustomer(customerId: string): Promise<{ deleted: boolean }> {
    try {
      const result = await asaasFetch(`${asaasApi.customers}/${customerId}`, {
        method: 'DELETE',
      });
      return result;
    } catch (error: any) {
      console.error('❌ Erro ao deletar cliente:', error);
      throw new Error('Erro ao deletar cliente');
    }
  }

  /**
   * Restaura um cliente deletado
   */
  static async restoreCustomer(customerId: string): Promise<AsaasCustomerResponse> {
    try {
      return await asaasFetch(`${asaasApi.customers}/${customerId}/restore`, {
        method: 'POST',
      });
    } catch (error: any) {
      console.error('❌ Erro ao restaurar cliente:', error);
      throw new Error('Erro ao restaurar cliente');
    }
  }
}

export const asaasCustomerService = new AsaasCustomerService();