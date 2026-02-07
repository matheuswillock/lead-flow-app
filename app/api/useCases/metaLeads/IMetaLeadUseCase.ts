import type { Output } from "@/lib/output";
import type { MetaLeadData } from "../../services/MetaLeadService";

/**
 * Interface do UseCase para processar leads do Meta
 */
export interface IMetaLeadUseCase {
  /**
   * Processa um lead recebido do Meta Lead Ads
   * 
   * @param leadgenId - ID do leadgen recebido no webhook
   * @param context - Contexto do tenant e credenciais
   * @returns Output com o lead criado
   */
  processMetaLead(leadgenId: string, context: MetaLeadContext): Promise<Output>;

  /**
   * Processa webhook do Meta
   * 
   * @param payload - Payload do webhook
   * @param context - Contexto do tenant e credenciais
   * @returns Output com resultado do processamento
   */
  processWebhook(payload: any, context: MetaLeadContext): Promise<Output>;
}

export interface MetaLeadContext {
  managerId: string;
  teamId?: string | null;
  pageAccessToken: string;
  defaultAssigneeId?: string | null;
  metaPageId?: string | null;
}

/**
 * DTO para criação de lead a partir do Meta
 */
export interface CreateLeadFromMetaDTO {
  metaData: MetaLeadData;
  managerId: string;
  teamId?: string | null;
  assignedTo?: string | null;
  metaPageId?: string | null;
}
