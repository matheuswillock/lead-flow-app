# Assinaturas e add-ons: índice e estado das SPECs

Feature: cobrança AbacatePay, acesso em carência e gestão de faturas.
Data de referência: 2026-11-26. Fases A, B e C entregues e mergeadas na `develop` (PRs [#1381](https://github.com/matheuswillock/lead-flow-app/pull/1381), #1408, #1413, #1414, [#1431](https://github.com/matheuswillock/lead-flow-app/pull/1431) e [#1432](https://github.com/matheuswillock/lead-flow-app/pull/1432)); fases D, E, F e G pendentes. Plano completo em [07-plano-das-fases.md](07-plano-das-fases.md).

## Documentos

| Documento | Escopo | Estado |
| --- | --- | --- |
| [01-feature.md](01-feature.md) | Por que a feature existe, o que implementa, riscos | Atualizado |
| [spec-backend.md](spec-backend.md) | SPEC de backend: regras, contratos, dados, testes | Atualizada |
| [spec-frontend.md](spec-frontend.md) | SPEC de frontend: telas, regras, interações, estados | Atualizada |
| [02-frontend.md](02-frontend.md) | Notas de implementação de frontend, com gates | Atualizado |
| [03-backend.md](03-backend.md) | Notas de implementação de backend, com gates | Atualizado |
| [04-progresso.md](04-progresso.md) | Status da entrega, auditoria e log | Atualizado |
| [05-decisoes.md](05-decisoes.md) | Decisões D1 a D18 | Atualizado em 2026-11-26 |
| [06-fase-c-renovacao.md](06-fase-c-renovacao.md) | Fase C: renovação reativa, carência, corte do Asaas, validação | Atualizado em 2026-11-25 |
| [07-plano-das-fases.md](07-plano-das-fases.md) | Plano das fases A a G, estado de cada uma, próximos passos de D a G | Novo em 2026-11-26 |
| [design/](design/) | Briefings de tela (`impeccable shape`) | Inclui [renovacao-usuarios-adicionais.md](design/renovacao-usuarios-adicionais.md) (2026-11-25), [regularizar-assinatura-painel-bloqueado.md](design/regularizar-assinatura-painel-bloqueado.md) (2026-11-25) e [checkout-pagamento-dedicado.md](design/checkout-pagamento-dedicado.md) (2026-11-26) |

## Estado das SPECs

| Tela ou capacidade | Backend | Frontend | Integração funcional |
| --- | --- | --- | --- |
| Acesso em carência por contrato | Implementado e mergeado (PR #1381) | Não se aplica | Mergeado. Regressão Member PRO + CRM não confirmada |
| Badge de acesso (T1) | Implementado e mergeado | Parcial: rótulo de leitura presente | Não validado no navegador |
| Cancelar fatura (T2) | Backend existente | Implementado e mergeado. Regra com teste, botão sem teste | Não validado no navegador |
| Cobrança de add-on por PIX | Implementado e mergeado (Fase B) | Existente | Sem sandbox |
| Cobrança de add-on por cartão (T3) | Implementado: só `ctok_`, cobra pelo AbacatePay | Parcial: checkout oferece cartão com a chave pública | Tokenização real não verificada |
| Consulta de status de add-on | Implementado e mergeado | Existente | Fluxo completo do webhook não verificado; reconciliação de `UNKNOWN` pendente |
| Troca de forma de pagamento | Recusada depois da confirmação (D2). Cobrança anterior não é cancelada | Existente | Tentativa substituída pendente |
| Indicador de modo leitura (T4) | `ReadOnlyAccessBanner` no shell, lendo `accountAccessDecision` | Parcial: faltam botões de escrita desabilitados | Fase G |
| Marcar como paga externamente (T5) | Não iniciado | Não iniciado | Fase D |
| Página de assinatura (T6) | Não iniciado | Não iniciado | Fase E |
| Botão "Regularizar assinatura" (T7) | Regra `canOfferPaymentFromBlockedFeature` | Implementado (D18) | Visto no navegador em 1280 e 375 px |
| Checkout em tela própria e confirmação (T8) | Rotas com sessão obrigatória, redirect 308 e `getServerSessionUserId` (D15 e D16) | Implementado (D15, D16 e D17) | Regularização vista com pagamento simulado; confirmação do add-on não verificada |
| Renovação reativa pelo roteador (carência, `past_due` por data, corte do Asaas) | Implementado e mergeado (PR #1432) | Não se aplica | Sem sandbox. Corte do Asaas desligado por padrão (D10, D11) |
| Aviso de perda do ilimitado na renovação | Cotação já existia | Implementado e mergeado (PR #1432), passes do `impeccable` feitos | Vista com dados reais do banco local em 1440, 375 e 640 px (F10.G6) |
| E-mail dos avisos da carência | Implementado e mergeado (PR #1432, D12). O link aponta para `/pagamento/[supabaseId]` | Não se aplica | E-mail não renderizado nem enviado de verdade |
| Alertas de inadimplência (degraus 6 a 15 e 16+) | Parcial: avisos da carência feitos (D12). Destinatário e degraus de janela fixa pendentes | Não se aplica | Fase F |

## Ordem de leitura

1. [01-feature.md](01-feature.md), para contexto.
2. [05-decisoes.md](05-decisoes.md), para as decisões já tomadas.
3. [spec-backend.md](spec-backend.md) e [spec-frontend.md](spec-frontend.md), para o que deve ser construído.
4. [03-backend.md](03-backend.md) e [02-frontend.md](02-frontend.md), para o andamento com gates.
5. [04-progresso.md](04-progresso.md), para a auditoria e o estado da entrega.
