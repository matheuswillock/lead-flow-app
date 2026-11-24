# Briefing de design: checkouts em fases

Status: **aguardando confirmação do usuário.** Nenhum JSX foi escrito. Este briefing cobre o kit compartilhado e as quatro jornadas com formulário.

## 1. Trabalho e público

- **Quem chega:** representante ou responsável pela empresa que contrata o Corretor Studio (A, B), quem recebe o link de adesão (B, C), quem compra um add-on (C) e quem renova a assinatura em carência (D).
- **Contexto:** pagamento sob pressão de tempo, geralmente no celular, com o PIX ou o cartão já decidido.
- **Modo:** **Operate.** É uma tarefa com começo e fim. Precisão e consistência. A marca aparece nos detalhes. Laranja só no CTA principal e em estados ativos.
- **Resultado:** o cliente completa o pedido e gera o pagamento com o mínimo de atrito.

## 2. Resultado e prova

- **Ação principal:** escolher período, preencher os dados e pagar (PIX ou cartão).
- **Sucesso:** pedido criado e pagamento gerado, ou tela de sucesso (`AdhesionSuccessScreen`).
- **Verdades do produto que aparecem na tela:** preço vindo do servidor, economia do PIX no badge, total com cupom e adicionais, validade do QR Code, e-mail de acesso após a confirmação, campo seguro do Abacate para o cartão.

## 3. Direção escolhida

- **Autoridade visual:** o `/checkout` (self-checkout) é a referência. As outras jornadas adotam o mesmo desenho. DESIGN.md manda: tokens semânticos, Poppins nos títulos, Inter no corpo, sem cores fixas.
- **Estrutura:** uma rota por jornada, sem troca de URL. Duas colunas em desktop: conteúdo à esquerda, lateral sticky à direita. A lateral tem a forma de pagamento, o resumo, o cupom, os termos e o botão de envio.
- **Stepper:** smoothui `animated-stepper` no topo da coluna principal, em modo controlado. Ele troca só o conteúdo da fase. Avanço e volta são feitos com **Continuar** e **Voltar**. Clique no stepper não avança para fase futura.
- **Ponto focal:** a escolha de pagamento e o total na lateral.
- **Consequência de implementação:** a forma de pagamento fica na lateral nas quatro jornadas (decidido pela referência). O conteúdo de cada fase é a única parte que muda de jornada para jornada.

## 4. Escopo e limites

- **Fidelidade:** pronto para produção nas jornadas A, B, C e D.
- **Fora de escopo:** `/checkout/[token]` (só escolha de plano com redirecionamento). Contextos, serviços, contratos de API e backend não mudam.
- **Intocado:** texto jurídico e links de termos, iframe do Abacate, cálculo de valores, validação de servidor.
- **Anti-objetivos:** novo mundo visual, mais de um acento de cor, gradiente em texto, grade de cards repetidos, animação em loop, botão laranja em grandes áreas.

## 5. Estados e faixas de conteúdo

- **Carregando:** `SelfCheckoutSkeleton`, com `role="status"`.
- **Erro de carregamento:** mensagem e botão de nova tentativa (`SelfCheckoutStateMessages`).
- **Indisponível:** quando não há período disponível.
- **Erro de envio:** alerta acima do botão; foco vai ao primeiro campo com erro, na fase certa.
- **PIX gerado:** QR Code, cópia do código, validade e validação manual (`AdhesionPixPanel`).
- **Cartão em análise, recusado ou corrigido:** painel de status com pill; "Corrigir dados do cartão" volta à fase do cartão.
- **Expirado:** `AdhesionStatusScreen`, sem equivalente no referência.
- **Sucesso:** `AdhesionSuccessScreen`.
- **Faixas:** 4 períodos (Mensal, Trimestral, Semestral, Anual); parcelas de 1x até o máximo do período (até 12x); de 0 a N usuários e equipes adicionais; cupom opcional.
- **Viewports:** 375 px e 1440 px. Cada jornada e forma de pagamento precisam ser verificadas nos dois.

## 6. Interação e layout

- **Topo da coluna:** stepper horizontal no desktop. No celular, testar 3 rótulos a 375 px e escolher entre o stepper horizontal e o texto "Passo X de Y".
- **Conteúdo da fase:** títulos sem números. Campos com `FieldGroup` e `Field`.
- **Navegação:** Voltar a partir da segunda fase, sem validar. Continuar valida só a fase atual. Envio valida tudo.
- **Mobile:** barra fixa inferior com total e botão. "Continuar" nas fases não finais; rótulo de envio na última.
- **Lateral:** sticky em `lg`. Abaixo do conteúdo no celular.
- **Transições:** curtas, com tokens de movimento. `prefers-reduced-motion` respeitado.
- **Toque e foco:** alvos de 44 px no celular (`max-lg:min-h-11`). Foco visível em todos os controles.

## 7. Restrições e decisões em aberto

- **Acessibilidade:** o botão primário `#ff6900` com texto branco tem contraste 2.89:1, abaixo de 4.5:1. Essa exceção foi decidida pelo dono em 2026-09-15 e não é alterada aqui. Fica registrada.
- **Textos:** PT-BR com acentos. Nomes de arquivo e identificadores em inglês.
- **Componentes:** reutilizar shadcn (`Select`, `Field`, `Card`, `Button`, `Skeleton`). Sem cores fixas em JSX.

**Decisões já tomadas nesta conversa:**
1. Modo Operate.
2. Cobrança de carência com casca clara, igual ao `/checkout`.
3. Campos crus de cartão removidos; sem chave Abacate, a opção de cartão some e só o PIX continua.

**Em aberto (não bloqueiam o briefing, mas precisam de resposta antes da implementação de cada jornada):**
- O add-on aceita parcelas no backend? Se não, o Select de parcelas fica oculto nessa jornada e o texto "em até Nx" sai.
- `fixedSchedule` do campo de parcelas: como fica no novo Select?
- Stepper em 375 px: horizontal ou texto "Passo X de Y"? Decidir após teste visual.

## 8. Confirmação

Confirme este briefing ou peça uma correção. Depois disso, a implementação começa pelo kit compartilhado e pela jornada A, com JSX só depois da aprovação.
