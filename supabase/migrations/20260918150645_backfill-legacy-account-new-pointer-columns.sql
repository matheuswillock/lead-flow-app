-- Achado P1 da revisão (chatgpt-codex-connector + cursor) — 30 — Migração
-- de Conta (execução) E3.
--
-- O cutover de 2026-08-31 (20260831232456_flip-pre-cutover-legacy.sql)
-- relabelou para 'legacy' TODO ponteiro Asaas que já existia, porque depois
-- do flip de envs "primary" passou a significar a conta NOVA. As duas
-- colunas criadas agora em 20260918010221_asaas-account-migration.sql
-- (`backoffice_clients.asaasAccount` e
-- `corretor_studio_profile_subscriptions.asaasSubscriptionAccount`) não
-- existiam naquele dia, então nasceram com o default 'primary' aplicado a
-- linhas que, na verdade, apontam para a conta ANTIGA.
--
-- Sem este backfill, a reconciliação de E7 (que passou a filtrar por conta
-- em 4ef86bd1) classificaria cada um desses ponteiros legados como FANTASMA
-- na varredura da conta legacy e como ponteiro órfão na varredura da
-- primary — ruído diário que esconderia divergência real.
--
-- DISCRIMINADOR DE TEMPO — por que aqui ele é necessário e é seguro:
-- diferente do flip de 31/08, estas colunas são novas, então TODA linha
-- (inclusive as criadas DEPOIS do cutover, que são legitimamente da conta
-- nova) recebeu 'primary'. Um flip cego mandaria para 'legacy' também as
-- linhas corretas. Por isso o corte por `createdAt < cutover`:
--
--   - backoffice_clients.createdAt: a linha é criada junto com o cadastro
--     do cliente no backoffice e o `asaasCustomerId` é gravado nesse mesmo
--     fluxo; linha anterior ao cutover com customer preenchido só pode
--     apontar para a conta antiga.
--   - corretor_studio_profile_subscriptions: aqui o `createdAt` sozinho NÃO
--     serve, e esse foi o achado P1 da revisão do lote unificado
--     (PR #1207). `ProfileSubscription.profileId` é `@unique`: existe uma
--     linha por profile, criada uma vez e **reescrita no lugar** a cada nova
--     assinatura. Uma linha anterior ao cutover cujo `asaasSubscriptionId`
--     foi trocado depois por uma assinatura da conta NOVA continua com o
--     `createdAt` antigo — o corte por tempo a rotularia `legacy` e a
--     reconciliação passaria a procurá-la na conta errada, todo dia.
--     O discriminador correto é o ponteiro irmão: `corretor_studio_profiles.
--     asaasSubscriptionId` + `asaasSubscriptionAccount`, que o flip de 31/08
--     já rotulou. Quando os dois ponteiros são o MESMO `sub_` e o Profile
--     diz `legacy`, a linha é legada.
--
--     ACHADO P1 DA REVISÃO DO PR #1207 (2ª rodada, thread PRRT_...CUk2):
--     quando os dois ponteiros DIVERGEM, a versão anterior deste comentário
--     assumia "o ponteiro da ProfileSubscription é mais novo que o do
--     Profile e não é relabelado" — falso em geral. `SubscriptionUpgradeUseCase`
--     (migração de upgrade, DA2) substitui só o ponteiro do Profile pelo
--     sub_ novo da primary; a ProfileSubscription espelhada (quando existe)
--     fica com o sub_ ANTIGO até esse mesmo commit passar a sincronizá-la
--     também — histórico anterior a essa correção pode ter ficado com os
--     ponteiros divergentes e a ProfileSubscription ainda `primary` por
--     default, quando na verdade guarda o sub_ legado recém-inativado.
--     Não existe ledger populado hoje (`AsaasAccountMigration` nasce vazio —
--     a Fase 5 de execução real segue bloqueada em [[90 — Decisões em
--     aberto (owner)]]) capaz de arbitrar essa divergência caso a caso, então
--     o discriminador vira o mesmo corte por tempo já aceito para o caso
--     "sem ponteiro no Profile": ponteiros DIFERENTES (ou Profile nulo) +
--     `ProfileSubscription.createdAt < cutover` também relabela. É seguro
--     porque, neste código-base, toda escrita que troca o
--     `asaasSubscriptionId` de uma ProfileSubscription sincroniza o mesmo
--     valor no Profile no mesmo golpe (`BillingRepository.
--     updateSubscriptionData`, "Keep Profile in sync") — não existe hoje um
--     caminho que grave um sub_ NOVO só na ProfileSubscription mantendo
--     `createdAt` intocado, então uma linha pré-cutover com ponteiros
--     divergentes só pode ser o cenário acima (Profile avançou, sibling
--     ficou para trás), nunca um pointer novo legítimo mascarado por
--     `createdAt` velho.
--
-- A condição de ponteiro não-nulo segue o mesmo cuidado que o flip de 31/08
-- aplicou a backoffice_adhesions: linha sem identificador Asaas nunca tocou
-- conta nenhuma e deve permanecer 'primary'.
--
-- Idempotente: reaplicar não muda nada — o filtro `= 'primary'` só alcança
-- o que ainda não foi relabelado.

do $$
declare
  -- Mesmo instante usado em 20260831232456_flip-pre-cutover-legacy.sql.
  cutover_at constant timestamptz := '2026-08-31 23:25:11+00';
begin
  update "public"."backoffice_clients"
  set "asaasAccount" = 'legacy'
  where "asaasAccount" = 'primary'
    and "asaasCustomerId" is not null
    and "createdAt" < cutover_at;

  update "public"."corretor_studio_profile_subscriptions" as ps
  set "asaasSubscriptionAccount" = 'legacy'
  from "public"."corretor_studio_profiles" as p
  where p."id" = ps."profileId"
    and ps."asaasSubscriptionAccount" = 'primary'
    and ps."asaasSubscriptionId" is not null
    and (
      -- mesmo ponteiro do Profile, que o flip de 31/08 já rotulou
      (
        p."asaasSubscriptionId" = ps."asaasSubscriptionId"
        and p."asaasSubscriptionAccount" = 'legacy'
      )
      -- sem ponteiro no Profile para comparar, OU ponteiro do Profile já
      -- avançou para outra assinatura (SubscriptionUpgradeUseCase DA2
      -- migra só o ponteiro do Profile) — cai no discriminador de tempo
      or (
        (p."asaasSubscriptionId" is null or p."asaasSubscriptionId" != ps."asaasSubscriptionId")
        and ps."createdAt" < cutover_at
      )
    );
end $$;
