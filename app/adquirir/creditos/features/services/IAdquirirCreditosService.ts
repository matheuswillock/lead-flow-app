import type { CreditPlan, AdquirirCreditosResult } from "../context/AdquirirCreditosTypes";

export interface IAdquirirCreditosService {
  iniciarCompra(input: { plan: CreditPlan }): Promise<AdquirirCreditosResult>;
}
