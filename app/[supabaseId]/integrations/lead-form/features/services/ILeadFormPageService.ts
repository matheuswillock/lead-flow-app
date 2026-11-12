/**
 * Fatia ISP do `IIntegrationsService` específica da página do Formulário de
 * Captação — só o que ela precisa (copiar a URL), nunca o webhook legado ou
 * o pixel, que também vivem naquele service compartilhado.
 */
export interface ILeadFormPageService {
  copyToClipboard(value: string): Promise<boolean>;
}
