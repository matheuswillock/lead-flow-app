// app/api/services/IAsaasCustomerService.ts
import type { AsaasCustomer, AsaasCustomerResponse } from './AsaasCustomerService';

export interface IAsaasCustomerService {
  createCustomer(data: AsaasCustomer): Promise<{ success: boolean; customerId: string; data: AsaasCustomerResponse }>;
  getCustomer(customerId: string): Promise<AsaasCustomerResponse>;
  getCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomerResponse | null>;
  listCustomers(params?: {
    offset?: number;
    limit?: number;
    email?: string;
    name?: string;
  }): Promise<{ data: AsaasCustomerResponse[]; hasMore: boolean; totalCount: number; limit: number; offset: number }>;
  updateCustomer(customerId: string, data: Partial<AsaasCustomer>): Promise<AsaasCustomerResponse>;
  deleteCustomer(customerId: string): Promise<{ deleted: boolean }>;
  restoreCustomer(customerId: string): Promise<AsaasCustomerResponse>;
}

