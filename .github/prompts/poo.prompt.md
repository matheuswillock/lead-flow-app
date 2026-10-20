---
mode: 'agent'
description: "Aplicar POO sustentável no Lead Flow com encapsulamento, abstração, polimorfismo, composição e fronteiras entre domínio e providers."
---

<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: .claude/skills/poo.md -->
<!-- Regenerate with: bun run skills:sync -->


# POO

Use esta skill sempre em conjunto com `clean-code` antes de criar ou refatorar classes, interfaces, providers, gateways, services ou UseCases.

## Objetivo

Aplicar os quatro pilares da programação orientada a objetos em TypeScript sem criar herança artificial:

- **Encapsulamento:** o estado mutável deve ficar privado ou protegido; exponha operações que preservem invariantes. Propriedades públicas de objetos de domínio e providers devem ser `readonly` quando precisarem ser públicas.
- **Abstração:** o domínio depende de contratos pequenos e orientados a capacidades, não de SDKs, payloads HTTP, URLs ou tipos específicos de um fornecedor.
- **Herança:** use apenas quando existir comportamento ou invariante realmente compartilhado. Classes-base devem ser pequenas, estáveis e livres de regras específicas de um provider.
- **Polimorfismo:** represente variações com interfaces, estratégias, composição e injeção de dependência. Toda implementação substituível deve cumprir o contrato da capacidade que implementa.

Interfaces, composição, estratégia e injeção de dependência são POO válida. A skill não exige que toda classe herde de outra classe.

## Fronteiras e dependências

- UseCases e domínio dependem de interfaces por capacidade, nunca de uma classe concreta, SDK ou tipo de provider.
- Adapters de infraestrutura traduzem modelos internos para payloads externos e traduzem respostas externas para modelos internos.
- Tipos como `Asaas*`, `Abacate*`, `Stripe*` e tipos importados de SDKs devem permanecer na fronteira do adapter. Não atravesse essa fronteira com `Request`, `Response`, payload ou erro externo.
- Quando houver mais de uma implementação, selecione-a em uma factory, router, registry ou estratégia. Não faça `new Provider()` dentro de domínio ou UseCase.
- Injete dependências no construtor ou por opções tipadas. Fakes e stubs devem conseguir substituir as interfaces nos testes.
- Prefira interfaces pequenas, coesas e orientadas a uma capacidade. Divida contratos que misturam criação, consulta, cobrança, cancelamento ou webhook.

## Classes e interfaces

- Dê nomes técnicos em inglês, consistentes com o projeto, e nomes que expressem responsabilidade.
- Mantenha classes com uma responsabilidade e métodos em um nível de abstração.
- Declare estado interno como `private` ou `protected`. Evite campos públicos mutáveis e parameter properties públicas.
- Use `readonly` para dependências e dados que não mudam depois da construção.
- Uma classe-base não deve conhecer regras de um provider específico; extraia a capacidade para uma estratégia ou adapter.
- Não crie uma interface apenas para satisfazer um checklist. Crie-a quando representar uma porta, uma capacidade ou uma substituição útil.

## Fluxo obrigatório

1. Leia `clean-code` e esta skill antes do planejamento técnico.
2. Identifique o contrato de entrada e saída do domínio.
3. Defina portas pequenas antes das implementações concretas.
4. Componha ou injete implementações; deixe a seleção de provider em uma factory/router.
5. Teste UseCases com fakes das portas e adapters com testes de tradução e contrato.
6. Execute `bun run lint:poo`, `bun run lint:pt-br:strict`, `bun run lint` e `bun run typecheck`.

O lint de POO verifica fronteiras observáveis; ele não tenta provar semanticamente que toda classe possui os quatro pilares. A ortografia de textos em PT-BR pertence ao `lint:pt-br:strict`; identificadores técnicos seguem as convenções do código.
