/**
 * Versões do contrato do webhook de entrada (SPEC 11, DA1/DA2).
 *
 * A versão gravada no `TeamWebhook` (`contractVersion`) é a fonte da verdade: o path da URL só a
 * espelha. Webhook v1 chamado pela rota v2 (e o contrário) é recusado com `version_mismatch`.
 */
export const INBOUND_CONTRACT_VERSIONS = [1, 2] as const;

export type InboundContractVersion = (typeof INBOUND_CONTRACT_VERSIONS)[number];

/** Todo webhook já configurado em produção é v1 (decisão de 21/09). */
export const LEGACY_INBOUND_CONTRACT_VERSION: InboundContractVersion = 1;

/** Versão do webhook criado a partir de agora. */
export const DEFAULT_INBOUND_CONTRACT_VERSION: InboundContractVersion = 2;

export const INBOUND_VERSION_MISMATCH_CODE = "version_mismatch";

export function isInboundContractVersion(value: unknown): value is InboundContractVersion {
  return typeof value === "number" && (INBOUND_CONTRACT_VERSIONS as readonly number[]).includes(value);
}
