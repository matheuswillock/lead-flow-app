import { LeadFinalized } from "@prisma/client";

export interface CreateLeadFinalizedDTO {
  leadId: string;
  finalizedAt: Date;
  amount: number;
  notes?: string;
}

export interface ILeadFinalizedRepository {
  /**
   * Cria um registro de venda finalizada
   */
  create(data: CreateLeadFinalizedDTO): Promise<LeadFinalized>;

  /**
   * Busca registros de vendas finalizadas por leadId
   */
  findByLeadId(leadId: string): Promise<LeadFinalized[]>;

  /**
   * Busca o último registro de venda finalizada de um lead
   */
  findLatestByLeadId(leadId: string): Promise<LeadFinalized | null>;
}
