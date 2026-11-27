# Briefing: botão "Regularizar assinatura" no painel "Acesso não liberado"

**Status:** aprovado pelo dono em 2026-11-25, depois de um briefing em chat. O texto original do briefing não foi guardado; este documento registra o escopo aprovado e o que foi implementado. Decisão em [05-decisoes.md](../05-decisoes.md) (D18).

## Superfície

App da conta (shell com sidebar), painel central "Acesso não liberado". Modo **Operate**.

## Estado atual (antes)

Quando a rota exige um módulo que o usuário não tem, o painel mostra o ícone de usuários, o título "Acesso não liberado" e o texto "Esta funcionalidade não está liberada para o seu usuário no momento." Nada leva o master ao pagamento, mesmo quando a causa é a assinatura em carência ou em somente leitura.

## Usuário

O master (dono da cobrança) com assinatura em carência ou somente leitura, que cai no painel ao abrir uma funcionalidade bloqueada.

## Direção

- O painel mantém ícone, título e texto como estão.
- Quando o usuário é o master **e** a conta tem cobrança pendente (carência ativa ou `read_only`), aparece abaixo do texto o botão "Regularizar assinatura", com o ícone de atualização, em largura total e altura de 44 px (`h-11 w-full`).
- O botão leva à página de pagamento da conta (`getPaymentRecoveryHref`). Desde D15 é `/pagamento/[supabaseId]`; antes era `/[supabaseId]/billing-grace-payment`.
- Sem cobrança pendente, ou para quem não é master, o painel segue só com o texto. A falta de módulo sem pendência não vira convite a pagar.
- Componente `FeatureBlockedPanel`; regra `canOfferPaymentFromBlockedFeature` (`app/[supabaseId]/components/accountAccessRecovery.ts`); uso em `LayoutContent.tsx`.

## Estados

Master com carência ou leitura (botão visível), master sem pendência (sem botão), membro que não é master (sem botão).

## Verificação

- Testes de unidade: `app/[supabaseId]/components/FeatureBlockedPanel.test.tsx` (regra e marcação com e sem botão).
- Visto no navegador com a conta de teste em carência, em 1280 px e em 375 px (prints enviados no chat em 2026-11-25 e 2026-11-26), e o clique levou à página de pagamento.
- Não verificado: revisão `impeccable` completa (só o detector automático rodou), leitor de tela e WebKit.
