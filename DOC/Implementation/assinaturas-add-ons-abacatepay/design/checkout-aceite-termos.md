# Briefing: botão de pagar bloqueado até o aceite dos termos (`/checkout`)

**Status:** aprovado pelo dono em 2026-11-26, com as três recomendações (pergunta 1: só o `/checkout`; pergunta 2: atalho no celular; pergunta 3: a caixa some no retry de pagamento). Implementado. Registro do gate em [02-frontend.md](../02-frontend.md) (F9).

**Refinamento feito na implementação (passes `adapt` e `colorize`):** no celular, o texto "Aceite os termos para pagar." e o link "Ir ao aceite" viraram **um único controle** (o próprio aviso é o atalho). Texto mais link quebrava em três linhas e inflava a barra de 69 para 101 px. O texto do atalho usa o primeiro plano e é sublinhado, porque o laranja da marca dava 2,89:1 em texto pequeno. A linha de apoio do desktop usa "Aceite os termos para..." (mesmo verbo do celular).
**Superfície:** checkout (contratação, self-checkout).
**Tela:** `app/checkout/` (`SelfCheckoutFormContainer.tsx`, `SelfCheckoutTermsAcceptance.tsx`, `components/checkout/CheckoutMobilePayBar.tsx`).
**Decisões relacionadas:** [D7](../05-decisoes.md) (aceite no checkout é o aceite do contrato).

## 1. Propósito

No checkout o aceite dos termos é a assinatura do contrato. O cliente só pode pagar depois de marcá-lo. Hoje a caixa existe, mas o botão de pagar fica habilitado: quem esquece de marcar clica, o formulário é validado, aparece o erro e a tela rola até a caixa. A decisão do dono (2026-11-25) é inverter: o botão de gerar o PIX ou de pagar com cartão fica **desabilitado** até a caixa estar marcada.

Sucesso: o cliente nunca chega a um clique que falha por falta de aceite, e entende na hora por que o botão está desabilitado e o que fazer.

## 2. Usuário e contexto

- **Quem:** corretor (ou o responsável pela corretora) contratando a plataforma. Pode estar no celular, entre outras tarefas.
- **Estado de espírito:** quer pagar rápido. Um botão cinza sem explicação parece quebrado.

## 3. O que já existe (não muda)

- A caixa de aceite fica no rodapé do resumo do pedido (`SelfCheckoutTermsAcceptance`), com os links dos três documentos em diálogos.
- O servidor continua sendo a autoridade: `termsAccepted: z.literal(true)` em `lib/self-checkout/contracts.ts`. O bloqueio na tela é conveniência, não segurança.
- A validação no envio continua como rede de proteção (envio por Enter, bug, extensão do navegador): se o aceite faltar, o erro aparece e a tela leva à caixa.

## 4. Regra proposta

O botão que **paga** fica desabilitado quando `!termsAccepted` e ainda não existe pedido:

- **Desktop:** o botão do rodapé do resumo ("Gerar QR Code PIX" ou "Pagar com cartão").
- **Celular:** o botão da barra fixa, **só na última fase**. Nas fases intermediárias ele é "Continuar", avança sem pagar, e continua habilitado.
- **Cartão:** a última fase é a dos dados do cartão. O bloqueio vale ali.
- **Pedido já criado (retry de pagamento):** não bloqueia. O aceite foi enviado na criação do pedido (o servidor o exige), então exigir a caixa de novo travaria quem só quer corrigir o cartão.

## 5. Como o cliente entende o motivo

Um botão desabilitado não recebe foco nem toque, então o motivo precisa estar à vista:

- **Desktop:** linha de apoio logo acima do botão, enquanto a caixa estiver desmarcada: "Marque o aceite dos termos para gerar o QR Code PIX" (ou "...para pagar com cartão"). Some quando a caixa é marcada. O botão aponta para ela com `aria-describedby`.
- **Celular:** a barra fixa troca a legenda embaixo do total por "Aceite os termos para pagar", com um botão de texto "Ir ao aceite" que rola até a caixa e a foca. A caixa fica abaixo do conteúdo, fora da vista, então sem esse atalho o cliente teria de adivinhar onde marcar.
- **Teclado e leitor de tela:** a ordem natural já coloca a caixa antes do botão. A caixa ganha `aria-required="true"`.

## 6. Estados

| Estado | Comportamento |
| --- | --- |
| Caixa desmarcada, última fase | Botão desabilitado (estilo desabilitado do design system), linha de apoio visível |
| Caixa marcada | Botão habilitado, linha de apoio some |
| Fase intermediária no celular | "Continuar" habilitado, sem linha de apoio de termos |
| Enviando (busy) | Como hoje: spinner e botão desabilitado |
| Pedido já criado (retry) | Botão habilitado, sem exigir a caixa; ver pergunta 3 |
| Erro do servidor no envio | Como hoje |
| Desmarcar depois de marcar | Botão volta a desabilitar na hora |
| Envio por Enter com a caixa desmarcada | Bloqueado pelo botão desabilitado (envio implícito); se chegar ao handler, a validação mostra o erro |

## 7. Direção visual

- Sem componente novo e sem cor nova. O estado desabilitado do botão já existe no design system (`opacity 0.5`, sem sombra).
- A linha de apoio usa `text-muted-foreground` em 12 a 13 px, no ritmo do texto do rodapé. É texto, não alerta: não usa cor semântica.
- O botão "Ir ao aceite" é um botão de texto (`ghost`/`link`) com alvo de toque de 44 px no celular.
- Sem animação nova.
- Acessibilidade: contraste do texto de apoio, foco visível no atalho, alvo de toque de 44 px.

## 8. Escopo

- **Fidelidade:** pronta para produção.
- **Arquivos:** `SelfCheckoutFormContainer.tsx` (regra e linha de apoio), `CheckoutMobilePayBar.tsx` (legenda e atalho, sem quebrar os outros checkouts que usam a barra), `SelfCheckoutTermsAcceptance.tsx` (`aria-required`), e testes da regra.
- **Fora do escopo:** renovação, add-on e adesão continuam com o aviso implícito "Ao pagar, você concorda" e sem bloqueio. Ver pergunta 1.
- **Texto:** PT-BR, sem travessão.

## 9. Perguntas para aprovação

1. **Só o `/checkout`?** A proposta é bloquear apenas o checkout de contratação, que é onde a caixa existe. Renovação, add-on e adesão não têm caixa hoje. Quer estender a caixa a eles (isso seria outro briefing) ou manter o aviso implícito?
2. **Atalho no celular.** "Ir ao aceite" na barra fixa entra, ou prefere mover a caixa para dentro do conteúdo da última fase (mudança de layout maior)?
3. **Retry de pagamento.** Sem exigir a caixa (proposta). A caixa continua visível e desmarcada nessa tela, ou deve sumir, já que o aceite foi dado na criação do pedido?
