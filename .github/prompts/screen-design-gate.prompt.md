---
mode: 'agent'
description: "Gate obrigatório para toda tela nova ou alterada do Corretor Studio. Exige o briefing do impeccable shape aprovado antes do JSX e a sequência de validação do impeccable com verificação renderizada depois da implementação. Usar sempre que uma página, layout, componente visual ou fluxo de tela for criado ou alterado."
---

<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: .claude/skills/screen-design-gate/SKILL.md -->
<!-- Regenerate with: bun run skills:sync -->


# Gate de design de tela

## Escopo

Vale para páginas e componentes visuais do app autenticado, backoffice, checkout e fluxos internos. Landing pública segue `docs/design/METODO-LANDING-PAGE.md` e não usa este gate.

## Antes do JSX (bloqueante)

1. Declare a superfície em uma linha: app, backoffice, checkout ou outra. A superfície define densidade e composição. Não define identidade: os tokens de `DESIGN.md` valem sempre.
2. Leia `DESIGN.md`, `PRODUCT.md` e, se existir, a SPEC da tela em `DOC/Implementation/<feature>/spec-frontend.md`.
3. Rode o briefing com `impeccable shape <tela>`. Registre o resultado em `DOC/Implementation/<feature>/design/<tela>.md` com objetivo, usuário, estados, ações, restrições e perguntas abertas.
4. Peça aprovação explícita do usuário ao briefing. Sem aprovação, pare. Não escreva JSX.
5. Só depois da aprovação, implemente com `corretor-studio-design`, `corretor-studio-frontend`, `corretor-studio-ui` e `design-system-guard`, seguindo o briefing aprovado.

## Depois da implementação (bloqueante antes de entregar)

Execute uma etapa por vez. Revise o resultado de cada uma antes de iniciar a próxima. Use o mesmo alvo em todas:

1. `impeccable harden --target <tela>`
2. `impeccable clarify --target <tela>`
3. `impeccable adapt --target <tela>`
4. `impeccable typeset --target <tela>`
5. `impeccable colorize --target <tela>`
6. `impeccable polish --target <tela>`

Depois das seis etapas:

7. `bun run design:check` precisa passar.
8. Verifique a tela renderizada com `browser-harness` ou `preview_start`, em 375 px e 1440 px. Cubra os estados vazio, carregando e erro. Confirme console sem erros, ausência de rolagem horizontal e foco visível nos controles.
9. Registre no gate da tela, em `DOC/Implementation/<feature>/02-frontend.md`: comando, resultado e o que não foi verificado.

## Regras

- Se `impeccable`, o navegador ou os dados necessários não estiverem disponíveis, registre o que não foi verificado. Não declare validação visual completa.
- Achado de `impeccable` que contrarie `DESIGN.md`, `PRODUCT.md` ou acessibilidade não é aplicado. Registre a divergência para decisão.
- Texto de interface em português do Brasil. Nomes de arquivos e identificadores em inglês.
- Este gate não substitui os testes E2E e de cobertura responsiva exigidos por `agents.md`.
