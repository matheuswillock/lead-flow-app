# Assinaturas e add-ons: índice e estado das SPECs

Feature: cobrança AbacatePay, acesso em carência e gestão de faturas.
Data de referência: 2026-11-17. PR: [#1381](https://github.com/matheuswillock/lead-flow-app/pull/1381).

## Documentos

| Documento | Escopo | Estado |
| --- | --- | --- |
| [01-feature.md](01-feature.md) | Por que a feature existe, o que implementa, riscos | Atualizado |
| [spec-backend.md](spec-backend.md) | SPEC de backend: regras, contratos, dados, testes | Atualizada |
| [spec-frontend.md](spec-frontend.md) | SPEC de frontend: telas, regras, interações, estados | Atualizada |
| [02-frontend.md](02-frontend.md) | Notas de implementação de frontend, com gates | Atualizado |
| [03-backend.md](03-backend.md) | Notas de implementação de backend, com gates | Atualizado |
| [04-progresso.md](04-progresso.md) | Status da entrega, auditoria e log | Atualizado |
| [05-decisoes.md](05-decisoes.md) | Decisões D1 a D14 | Atualizado em 2026-11-25 |
| [06-fase-c-renovacao.md](06-fase-c-renovacao.md) | Fase C: renovação reativa, carência, corte do Asaas, validação | Atualizado em 2026-11-25 |
| [design/](design/) | Briefings de tela (`impeccable shape`) | Inclui [renovacao-usuarios-adicionais.md](design/renovacao-usuarios-adicionais.md), aprovado em 2026-11-25 |

## Estado das SPECs

| Tela ou capacidade | Backend | Frontend | Integração funcional |
| --- | --- | --- | --- |
| Acesso em carência por contrato | Implementado no PR | Não se aplica | Implementado no PR. Regressão Member PRO + CRM não confirmada |
| Badge de acesso (T1) | Implementado no PR | Parcial: rótulo de leitura presente | Não validado no navegador |
| Cancelar fatura (T2) | Backend existente | Implementado no PR | Sem teste automatizado |
| Cobrança de add-on por PIX | Implementado localmente | Existente | Não validado no sandbox |
| Cobrança de add-on por cartão (T3) | Bloqueada | Não implementado | Decidida (D1). Pendente |
| Consulta de status de add-on | Implementado localmente | Existente | Webhook pendente |
| Troca de forma de pagamento | Sem cancelamento da anterior | Existente | Decidida (D2). Pendente |
| Indicador de modo leitura (T4) | Campo `mode` pronto | Não iniciado | Fase G |
| Marcar como paga externamente (T5) | Não iniciado | Não iniciado | Fase D |
| Página de assinatura (T6) | Não verificado | Não verificado | Fase E |
| Renovação reativa pelo roteador (carência, `past_due` por data, corte do Asaas) | Implementado na branch da Fase C | Não se aplica | Sem sandbox. Corte do Asaas desligado por padrão (D10, D11) |
| Aviso de perda do ilimitado na renovação | Cotação já existia | Implementado na branch da Fase C, passes do `impeccable` feitos | Vista com dados reais do banco local em 1440, 375 e 640 px (F10.G6) |
| E-mail dos avisos da carência | Implementado na branch da Fase C (D12) | Não se aplica | E-mail não renderizado nem enviado de verdade |
| Alertas de inadimplência (degraus 6 a 15 e 16+) | Não verificado | Não se aplica | Fase F |

## Ordem de leitura

1. [01-feature.md](01-feature.md), para contexto.
2. [05-decisoes.md](05-decisoes.md), para as decisões já tomadas.
3. [spec-backend.md](spec-backend.md) e [spec-frontend.md](spec-frontend.md), para o que deve ser construído.
4. [03-backend.md](03-backend.md) e [02-frontend.md](02-frontend.md), para o andamento com gates.
5. [04-progresso.md](04-progresso.md), para a auditoria e o estado da entrega.
