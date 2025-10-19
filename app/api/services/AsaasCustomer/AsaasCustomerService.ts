// app/api/services/AsaasCustomerService.ts
import { asaasApi, asaasFetch } from '@/lib/asaas';

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
  /**
   * Cria um novo cliente Manager no Asaas
   */
  static async createCustomer(data: AsaasCustomer) {
    try {
      // Debug: Log the actual data being sent (with masked sensitive info)
      console.info('🚀 [AsaasCustomerService] Enviando para Asaas:', {
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        cpfCnpjLength: data.cpfCnpj?.length || 0,
        cpfCnpjType: typeof data.cpfCnpj,
        phone: data.phone?.substring(0, 4) + '***',
        phoneLength: data.phone?.length || 0
      });
      
      const customer = await asaasFetch(asaasApi.customers, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return {
        success: true,
        customerId: customer.id,
        data: customer as AsaasCustomerResponse,
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
      return await asaasFetch(`${asaasApi.customers}/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar cliente:', error);
      throw new Error(error.message || 'Erro ao atualizar cliente');
    }
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