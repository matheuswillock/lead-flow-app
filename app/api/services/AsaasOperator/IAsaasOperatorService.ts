// app/api/services/IAsaasOperatorService.ts
import type { OperatorBilling } from './AsaasOperatorService';

export interface IAsaasOperatorService {
  addOperator(managerId: string, operatorId: string): Promise<{ success: boolean; subscriptionId: string; operatorId: string; managerId: string; value: number; message: string }>;
  removeOperator(operatorId: string): Promise<{ success: boolean; operatorId: string; managerId: string; message: string }>;
  calculateMonthlyBilling(managerId: string): Promise<OperatorBilling>;
  listOperators(managerId: string, includeInactive?: boolean): Promise<{ operators: any[]; count: number }>;
  transferOperator(operatorId: string, newManagerId: string): Promise<{ transferred: boolean; operatorId: string; newManagerId: string }>;
  suspendOperator(operatorId: string): Promise<{ suspended: boolean; operatorId: string }>;
  reactivateOperator(operatorId: string): Promise<{ reactivated: boolean; operatorId: string }>;
}
