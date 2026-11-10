import { integrationsService } from "@/app/[supabaseId]/integrations/features/services/IntegrationsService";
import type { ILeadFormPageService } from "./ILeadFormPageService";

/**
 * Delega para o `integrationsService` compartilhado (mesmo boundary que
 * `IntegrationsContext` já usa) em vez de duplicar a chamada — só estreita a
 * interface para o que a página do Formulário de Captação precisa (ISP).
 */
class LeadFormPageService implements ILeadFormPageService {
  copyToClipboard(value: string): Promise<boolean> {
    return integrationsService.copyToClipboard(value);
  }
}

export const leadFormPageService = new LeadFormPageService();
