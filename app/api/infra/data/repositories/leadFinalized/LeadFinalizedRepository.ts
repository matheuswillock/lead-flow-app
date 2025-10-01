import { prisma } from "../../prisma";
import type { 
  ILeadFinalizedRepository, 
  CreateLeadFinalizedDTO 
} from "./ILeadFinalizedRepository";
import { LeadFinalized } from "@prisma/client";

export class LeadFinalizedRepository implements ILeadFinalizedRepository {
  
  /**
   * Cria um registro de venda finalizada
   */
  async create(data: CreateLeadFinalizedDTO): Promise<LeadFinalized> {
    return await prisma.leadFinalized.create({
      data: {
        leadId: data.leadId,
        finalizedDateAt: data.finalizedAt,
        startDateAt: data.startDateAt || data.finalizedAt,
        duration: data.duration || 0,
        amount: data.amount,
        notes: data.notes,
      },
    });
  }

  /**
   * Busca registros de vendas finalizadas por leadId
   */
  async findByLeadId(leadId: string): Promise<LeadFinalized[]> {
    return await prisma.leadFinalized.findMany({
      where: {
        leadId,
      },
      orderBy: {
        finalizedDateAt: 'desc',
      },
    });
  }

  /**
   * Busca o último registro de venda finalizada de um lead
   */
  async findLatestByLeadId(leadId: string): Promise<LeadFinalized | null> {
    return await prisma.leadFinalized.findFirst({
      where: {
        leadId,
      },
      orderBy: {
        finalizedDateAt: 'desc',
      },
    });
  }
}

// Instância única para uso em toda aplicação
export const leadFinalizedRepository = new LeadFinalizedRepository();
