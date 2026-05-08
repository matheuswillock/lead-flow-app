# Contexto do Projeto: Corretor Studio (Lead Flow App)

{{PARAGRAFO_INTRODUTORIO}}
<!-- O que é o produto, nome comercial vs. nome no código, propósito central -->

Este documento consolida o entendimento do projeto com base na análise do repositório, documentação existente e na modelagem de dados no Supabase.

## 1. Público-Alvo e Modelo de Negócio

{{PARAGRAFO_PUBLICO_ALVO}}
<!-- Corretoras de saúde que trabalham com a venda de planos de saúde. Problema que resolve. -->

### Modelo de Precificação (Assinatura Recorrente)

O Corretor Studio não possui *free trial*. Ele opera em um modelo de assinatura SaaS com cobrança recorrente via integração com a plataforma **Asaas** (suportando PIX e cartão de crédito):

<!-- Preencher com dados reais do Supabase (backoffice_products + backoffice_product_payment_rules) -->

| Plano | Ciclo | PIX | Cartão de Crédito |
|---|---|---|---|
| CRM | Mensal | R$ {{PRECO_MENSAL_PIX}} | R$ {{PRECO_MENSAL_CARTAO}} |
| CRM | Trimestral | R$ {{PRECO_TRIMESTRAL_PIX}}/mês | R$ {{PRECO_TRIMESTRAL_CARTAO}}/mês |
| CRM | Semestral | R$ {{PRECO_SEMESTRAL_PIX}}/mês | R$ {{PRECO_SEMESTRAL_CARTAO}}/mês |

Além da assinatura base, o sistema trabalha com *Add-ons*:

| Add-on | Preço/mês |
|---|---|
| Usuário Adicional (Operador) | R$ {{PRECO_ADDON_USUARIO}} |
| Time Adicional | R$ {{PRECO_ADDON_TIME}} |

## 2. Níveis de Acesso e Funções Operacionais

A gestão de equipe no Corretor Studio é estruturada através de uma combinação de **níveis de acesso** (que definem o que o usuário pode ver ou configurar no sistema) e **funções operacionais** (que definem o papel do usuário no funil de vendas).

### Níveis de Acesso (Roles)

| Nível | Descrição e Permissões |
|---|---|
| **Master** | Dono da conta. Por padrão é Manager, mas com privilégios máximos: gerenciar cobrança (assinaturas), criar/remover usuários e gerenciar ou transferir times. |
| **Manager** | Responsável por gerenciar a corretora, cadastrar times, assinar o produto e acompanhar as métricas de conversão. |
| **Backoffice** | Cuida de processos gerenciais de retaguarda, como a criação de propostas e o gerenciamento da carteira de clientes. |
| **Operator** | Tem acesso operacional às pipelines (Kanban/Tabela) e aos agendamentos de reuniões. |

### Funções Operacionais (Functions)

| Função | Descrição |
|---|---|
| **SDR** | Foca na prospecção inicial, agenda reuniões e gerencia o contato com os clientes nas etapas iniciais do funil. |
| **Closer** | Responsável por realizar as agendas com os novos leads, negociar as propostas e fechar efetivamente as vendas. |

## 3. Como Funciona a Plataforma

{{FLUXO_OPERACIONAL}}
<!-- Fluxo numerado: onboarding → gestão de equipe → CRM → agendamento → fechamento → métricas -->

## 4. Funcionalidades Principais

{{FUNCIONALIDADES}}
<!-- Módulos disponíveis vs. em breve/beta. Baseado em docsManualData.ts e app-sidebar.tsx -->

## 5. Arquitetura e Stack Tecnológica

{{STACK_E_ARQUITETURA}}
<!-- Stack (Next.js, React, TypeScript, Prisma, Supabase, Asaas, Resend) + padrões de Clean Architecture -->

## 6. Governança e IA

{{GOVERNANCA}}
<!-- Regras do agents.md relevantes para IAs que trabalham no projeto -->

## Conclusão

{{CONCLUSAO}}

## Referências

[1] Tabela `backoffice_products` e `backoffice_product_payment_rules` do banco de dados do Supabase (projeto `corretor-studio`).
