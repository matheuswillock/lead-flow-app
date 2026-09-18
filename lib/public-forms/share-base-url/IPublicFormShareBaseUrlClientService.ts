/**
 * Origem ativa para EXIBIR/COPIAR links de formulário no app (painel de
 * formulários do editor de template e lista de formulários).
 *
 * A fonte da verdade do ENVIO continua sendo o servidor
 * (`resolvePublicFormBaseUrl` no disparo) — este serviço só alinha o que o
 * usuário copia com o que a campanha vai enviar.
 */
export interface IPublicFormShareBaseUrlClientService {
  /** Origem (https://forms.time.com.br) do domínio VERIFICADO, ou null. */
  getVerifiedFormDomainBaseUrl(): Promise<string | null>
}
