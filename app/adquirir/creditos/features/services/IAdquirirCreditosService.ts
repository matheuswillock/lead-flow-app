import type { CreditPlan, AdquirirCreditosResult } from "../context/AdquirirCreditosTypes";

export interface IAdquirirCreditosService {
  validarCredito(input: {
    email: string;
    plan: CreditPlan;
  }): Promise<AdquirirCreditosResult>;
}