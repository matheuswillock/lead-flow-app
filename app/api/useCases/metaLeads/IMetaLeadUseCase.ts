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
   * @param managerId - ID do manager que receberá o lead (opcional, usa default se não informado)
   * @returns Output com o lead criado
   */
  processMetaLead(leadgenId: string, managerId?: string): Promise<Output>;

  /**
   * Processa webhook do Meta
   * 
   * @param payload - Payload do webhook
   * @param managerId - ID do manager (opcional)
   * @returns Output com resultado do processamento
   */
  processWebhook(payload: any, managerId?: string): Promise<Output>;
}

/**
 * DTO para criação de lead a partir do Meta
 */
export interface CreateLeadFromMetaDTO {
  metaData: MetaLeadData;
  managerId: string;
  assignedTo?: string;
}
