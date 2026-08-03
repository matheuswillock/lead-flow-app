-- D14: Novos tipos de identidade para perfis de titulares e dependentes de contrato
-- contract_holder: chaveado por document normalizado + teamId (LeadFinalizedHolder)
-- contract_dependent: chaveado por document normalizado + teamId (LeadFinalizedDependent com document preenchido)
-- Dependentes sem document não geram perfil próprio (sem chave natural confiável).

ALTER TYPE "radar_identity_type" ADD VALUE IF NOT EXISTS 'contract_holder';
ALTER TYPE "radar_identity_type" ADD VALUE IF NOT EXISTS 'contract_dependent';
