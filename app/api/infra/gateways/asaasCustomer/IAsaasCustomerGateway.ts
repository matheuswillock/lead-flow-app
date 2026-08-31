/**
 * Ponto único de criação de customer Asaas — E5 de
 * [[10 — Fundações Multi-conta — Backend]] (DA5, C6/§4 da auditoria).
 *
 * Vive em app/api/infra/gateways/ (não app/api/services/, como a SPEC
 * originalmente sugeria): BackofficeAdhesionService e
 * IncrementalBillingService — dois Services — precisam depender dele
 * diretamente, e governance:check bloqueia Service importando Service
 * (serviceImportOutsideUseCaseAllowlist) fora de autorização explícita do
 * owner. Um gateway para API externa é infraestrutura (mesma categoria de
 * Repository), não lógica de domínio — por isso mora ao lado de
 * infra/data/repositories, e Services podem depender dele como já
 * dependem de Repository.
 *

 * `notificationDisabled` e `externalReference` NÃO são campos do input: o
 * gateway os fixa por dentro (nasce silencioso e reconciliável sempre,
 * impossível criar barulhento por engano — nem em TypeScript nem em
 * runtime, já que um caller que force o campo via cast é ignorado, ver
 * AsaasCustomerGateway.test.ts).
 *
 * `profileId` é usado quando já existe um Profile (a maioria dos 6+
 * caminhos). `adhesionId` cobre os dois caminhos de
 * `BackofficeAdhesionService` que criam o customer ANTES de existir um
 * Profile (checkout de adesão pré-conversão) — âncora documentada como
 * discrepância da SPEC original em
 * [[01 — Auditoria Motor de Pagamentos ponta a ponta]] §12.
 */
export type CreateAsaasCustomerInput = {
  name: string
  email?: string
  cpfCnpj?: string
  phone?: string
  mobilePhone?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  observations?: string
} & ({ profileId: string; adhesionId?: undefined } | { adhesionId: string; profileId?: undefined })

export type CreatedAsaasCustomer = {
  id: string
}

export interface IAsaasCustomerGateway {
  createCustomer(input: CreateAsaasCustomerInput): Promise<CreatedAsaasCustomer>
}
