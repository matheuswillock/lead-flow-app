# Frontend: assinaturas e add-ons

Referência: [01-feature.md](01-feature.md) · Progresso: [04-progresso.md](04-progresso.md)

Legenda dos gates: `[x]` verificado no código ou em teste nesta data; `[ ]` pendente. Cada gate indica o comando de verificação e a evidência registrada.

Regra de origem: toda tela afetada passa primeiro pelo briefing `impeccable shape`, com aprovação antes do JSX. Depois da implementação, passa pela revisão `impeccable`. Nenhuma tela é reportada como pronta sem as duas etapas.

## F1. Badge de acesso do backoffice (Fase A2)

**Estado:** implementado e mergeado na `develop` (PR #1381). Os gates F1.G2 a F1.G5 seguem pendentes.

**Arquivos:** `app/backoffice/(app)/clients/[masterId]/features/container/BackofficeClientDetailsContainer.tsx`. O rótulo "Acesso (leitura)" está na linha 644.

- [x] F1.G1: rótulo do estado de leitura presente no PR.
  - CHECK: `git grep -n "Acesso (leitura)" origin/feature/bloqueio-assinatura-somente-leitura -- app/backoffice`
  - EVIDENCE: linha 644 do container.
- [ ] F1.G2: os três estados ("Acesso total", "Acesso (leitura)", "Sem acesso") renderizados na tela.
  - EVIDENCE: pendente. Só "Acesso (leitura)" foi confirmado no container. "Acesso total" e "Sem acesso" não foram localizados nesse arquivo.
- [ ] F1.G3: briefing `impeccable shape` aprovado antes do JSX.
  - EVIDENCE: não encontrado no repositório.
- [ ] F1.G4: validado no navegador em desktop e mobile.
  - EVIDENCE: pendente.
- [ ] F1.G5: revisão `impeccable` aplicada.
  - EVIDENCE: pendente.

## F2. Ação "Cancelar" na aba Faturas (Fase A3)

**Estado:** implementado e mergeado na `develop` (PR #1381).

**Arquivos:** mesmo container de F1. O menu de ações da linha está em `BackofficeInvoiceActionsMenu.tsx` e a regra em `features/utils/invoiceActions.ts`.
- `canCancelInvoice` (linha 115): só mostra o botão quando a fatura não é `adhesion_external`, não está paga e não está `WAIVED`.
- Botão "Cancelar" na linha da tabela (linha ~1310).
- `AlertDialog` "Cancelar esta fatura?" (linha ~1651), com ação "Cancelar fatura".

- [x] F2.G1: botão, condição de exibição e confirmação presentes no PR.
  - CHECK: `git grep -n "canCancelInvoice\|Cancelar esta fatura" origin/feature/bloqueio-assinatura-somente-leitura -- "app/backoffice"`
- [ ] F2.G2: teste automatizado do botão e da condição de exibição.
  - CHECK: `git grep -ln "canCancelInvoice\|Cancelar fatura" <ref> -- "*.test.tsx"`
  - EVIDENCE: em 2026-11-17 nenhum teste foi encontrado. Atualização de 2026-11-26: a regra de exibição tem teste (`app/backoffice/(app)/clients/[masterId]/features/utils/invoiceActions.test.ts`, presente na `develop`). O botão e o diálogo em si seguem sem teste.
- [ ] F2.G3: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F3. Indicador de modo leitura no shell (Fase G)

**Estado:** parcial. `ReadOnlyAccessBanner` (`app/[supabaseId]/components/ReadOnlyAccessBanner.tsx`, usado em `LayoutContent.tsx`) já aparece no shell quando a decisão de acesso é `read_only`. Ele lê `accountAccessDecision`, não o campo `mode` que `IFeatureAccessService` retorna (ver [03-backend.md](03-backend.md), nó B1). Faltam os botões de escrita desabilitados com explicação.

- [ ] F3.G1: indicador exibido quando `mode === "read_only"`, com explicação da restrição.
  - EVIDENCE: pendente.
- [ ] F3.G2: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F10. Renovação: aviso de perda do ilimitado (Fase C)

**Estado:** implementado e com os seis passes do `impeccable` (G4) e a verificação renderizada dos componentes (G5) concluídos em 2026-11-25. Falta ver a tela completa com dados reais.

**Briefing:** [design/renovacao-usuarios-adicionais.md](design/renovacao-usuarios-adicionais.md), aprovado pelo dono em 2026-11-25. As três perguntas abertas foram resolvidas pela recomendação do briefing: controle "Manter usuários ilimitados (plano anual)" entra, a linha "Inclui R$ X de usuários adicionais" entra em cada prazo, e a conta sem usuários adicionais recebe o aviso informativo sem valor.

**Arquivos:** `BillingGraceRenewalChoice.tsx` (aviso e linha por prazo), `BillingGracePaymentContainer.tsx` (liga o controle ao prazo anual), `features/utils/billingGraceUnlimitedLoss.ts` (regra do aviso, com teste).

- [x] F10.G1: briefing aprovado antes do JSX.
  - EVIDENCE: aprovação do dono na conversa de 2026-11-25.
- [x] F10.G2: regra do aviso testada (com valor, acompanha as caixas, todos desmarcados, sem usuários adicionais, sem perda).
  - CHECK: `bun test "app/pagamento/[supabaseId]/features/utils/billingGraceUnlimitedLoss.test.ts"`
  - EVIDENCE: EXIT=0, 5 testes.
- [x] F10.G3: `bun run design:check` e typecheck.
  - EVIDENCE: `design:check` EXIT=0 ("globals.css matches DESIGN.md"); typecheck EXIT=0. O hook automático do `impeccable` varreu os dois arquivos da tela sem achados.
- [x] F10.G4: passes `impeccable harden`, `clarify`, `adapt`, `typeset`, `colorize` e `polish`, um por vez, em 2026-11-25.
  - `harden`: preço de usuário zerado no backoffice não gera aviso nem a linha "Inclui R$ 0,00" (regra testada, 6 casos); o foco volta ao prazo escolhido quando "Manter usuários ilimitados" faz o aviso e o botão sumirem (por efeito do React, não por `requestAnimationFrame`, que falhou em aba em segundo plano).
  - `clarify`: o aviso passou a dizer por que o ilimitado se perde ("Só o plano anual inclui usuários ilimitados."); no mensal o total não repete o valor por usuário; "nos 3 meses" no lugar de "no prazo de 3 meses". O rótulo do botão aprovado no briefing não mudou.
  - `adapt`: em 320 px o rótulo do botão ultrapassava a borda (o botão base não quebra linha). Agora o botão cresce em altura e quebra o texto, com mínimo de 44 px no celular.
  - `typeset`: título semibold, corpo em tom secundário, total do prazo em destaque (semibold, numerais tabulares), `text-pretty` no corpo.
  - `colorize`: texto do corpo derivado do primeiro plano (não cinza genérico) e ícone escurecido por mistura do token com o primeiro plano, porque o tom puro do aviso não chegava a 3:1 sobre a superfície clara.
  - `polish`: verificação renderizada nos dois temas e em 320, 375, 768 e 1440 px (ver G5).
- [x] F10.G5: componentes renderizados em 375 px e 1440 px, com dados de exemplo.
  - EVIDENCE: a tela real (`/pagamento/[supabaseId]`, antes `/[supabaseId]/billing-grace-payment`) exige login e banco, então usei uma página descartável (`/oferta/preview-renewal`) montando `BillingGraceCycleChoice` e `BillingGraceBilledItems` com cotações de exemplo, servida por `bun run dev` com o Postgres local. A página e o `.env` de exemplo foram removidos.
    - 1440 px: aviso de atenção com 2 usuários (R$ 19,90 por usuário por mês, R$ 119,40 em 3 meses), controle de voltar ao anual, linha "Inclui R$ X de usuários adicionais" em cada prazo sem ilimitado. Visual coerente com o restante da tela (tema escuro).
    - Interações: desmarcar um usuário muda o aviso para 1 usuário (R$ 59,70); desmarcar todos muda para o aviso informativo de ninguém cobrado; o controle seleciona o anual e o aviso dá lugar a "Usuários ilimitados incluídos neste prazo".
    - 375 px, conta sem usuários adicionais: aviso informativo (tom de informação), sem rolagem horizontal (`scrollWidth` 375), botão com 44 px de altura.
    - Teclado: o botão recebe foco com anel visível (`:focus-visible` com sombra de foco). Ao acioná-lo com Enter, o foco vai para o prazo anual, com anel visível.
    - Contraste medido no DOM (WCAG), aviso de atenção com 2 usuários: escuro, corpo 8,74:1, título e total 12,73:1, ícone 7,20:1; claro, corpo 8,85:1, título e total 15,80:1, ícone 5,83:1. Aviso informativo, escuro: corpo 8,92:1, título 13,05:1, ícone 6,91:1. Todos acima de 4,5:1 (texto) e 3:1 (ícone).
    - Larguras: 320 px (sem rolagem horizontal, nada ultrapassa a borda, botão quebra em 74 px de altura), 375 px, 768 px e 1440 px.
  - Evidência: viewport emulado no Chromium do app, foco com teclado real (Tab e Enter). Não testado: Safari e Firefox, toque em aparelho físico, leitor de tela, zoom de 200%.
  - O console mostrou um erro de hidratação, causado pela página descartável (lia a URL na renderização), não pelos componentes.
- [x] F10.G6: tela real `/pagamento/[supabaseId]` com dados reais, em 2026-11-26 (depois do merge com a `develop`, que moveu a página de `/[supabaseId]/billing-grace-payment`).
  - EVIDENCE: master do seed no Postgres local, alterado temporariamente (ciclo anual vencido, 2 usuários adicionais reais e um segundo time) e restaurado depois; servidor em modo E2E com o cookie de sessão de teste.
    - 1440 px: o anual vem pré-selecionado (ciclo anterior da conta); o time adicional aparece com o valor real; com a marca de ilimitado desligada, escolher o trimestral mostra o aviso com os 2 usuários reais e os preços do backoffice (R$ 19,90 por usuário por mês, R$ 119,40 nos 3 meses), a linha "Inclui R$ X de usuários adicionais" em cada prazo, e o resumo do pedido acompanha (usuários adicionais e times adicionais).
    - O atalho "Manter usuários ilimitados" seleciona o anual, o aviso some e o foco vai para o prazo anual. A fase de pagamento mantém o aviso implícito "Ao pagar, você concorda" com o botão habilitado (o bloqueio por termos é só do `/checkout`).
    - Conta com ilimitado concedido manualmente (o master do seed): nenhum prazo mostra o aviso, porque nenhum prazo tira o ilimitado dela. Contas anuais reais não têm essa marca (`Profile.hasUnlimitedUsers` só é gravado por scripts de Member PRO), então dependem do ciclo `annual`.
    - 375 px: sem rolagem horizontal, aviso e botão dentro da tela (botão em duas linhas, 54 px), barra fixa com o total e "Continuar" (69 px).
    - Layout de 640 px (equivalente a 200% de zoom em 1280 px): sem estouro, aviso visível, botão com 44 px.
  - Estados com a tela real: conta vitalícia mostra "Assinatura vitalícia não tem renovação" com "Tentar de novo".
  - NÃO verificado: leitor de tela real; zoom de texto do navegador (só o layout equivalente por largura); estados vazio e carregando dessa tela (não mudaram).

## F11. Checkout: botão de pagar bloqueado até o aceite dos termos (Fase C)

**Estado:** implementado em 2026-11-26, verificado renderizado na tela real do `/checkout` e por E2E.

**Briefing:** [design/checkout-aceite-termos.md](design/checkout-aceite-termos.md), aprovado pelo dono em 2026-11-26 com as três recomendações: só o `/checkout`; atalho no celular; caixa escondida no retry de pagamento. Decisão de produto em [D7](05-decisoes.md).

**Arquivos:** `SelfCheckoutFormContainer.tsx` (regra, linha de apoio, bloqueio dos dois botões, caixa escondida no retry), `components/checkout/CheckoutMobilePayBar.tsx` (prop opcional `hint`, sem efeito nos outros checkouts), `SelfCheckoutTermsAcceptance.tsx` (`aria-required`), `features/utils/selfCheckoutTermsGate.ts` (regra, com teste), `e2e/specs/public/checkout.spec.ts`.

- [x] F11.G1: briefing aprovado antes do JSX.
  - EVIDENCE: aprovação do dono na conversa de 2026-11-26.
- [x] F11.G2: regra testada.
  - CHECK: `bun test app/checkout/features/utils/selfCheckoutTermsGate.test.ts`
  - EVIDENCE: EXIT=0, 7 testes (bloqueia sem aceite, libera com aceite, desmarcar bloqueia de novo, pedido criado nunca bloqueia).
- [x] F11.G3: E2E no navegador (Chromium, Playwright, servidor de desenvolvimento).
  - CHECK: `E2E_REUSE_SERVER=1 E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/specs/public/checkout.spec.ts`
  - EVIDENCE: 18 de 18 passam (2 testes novos: desktop com bloqueio, linha de apoio e desmarcar; celular com "Continuar" livre, última fase bloqueada, atalho que foca a caixa e libera o botão).
  - Teste existente corrigido: "valida os campos inline sem chamar a API" clicava em pagar sem marcar os termos e passaria a travar esperando o botão habilitar; agora marca a caixa antes. Era o único E2E afetado.
  - Controle negativo: sem o `disabled` por termos, o teste novo do desktop falha ("Expected: disabled, Received: enabled"); restaurado e 18 de 18 verdes.
  - Ressalva do E2E: o teste do celular dispara o clique do atalho por `dispatchEvent`, porque no `bun run dev` o selo do Next cobre esse canto e intercepta o toque (em build de produção o selo não existe).
- [x] F11.G4: passes `impeccable harden`, `clarify`, `adapt`, `typeset`, `colorize` e `polish`, um por vez, em 2026-11-26.
  - `harden`: com a caixa desmarcada o botão desabilitado bloqueia também o envio por Enter (nada é enviado e nenhum erro aparece); no retry de pagamento a caixa não aparece e o botão não exige aceite; o motivo fica associado ao botão por `aria-describedby`.
  - `clarify`: mesmo verbo nos dois tamanhos ("Aceite os termos para gerar o QR Code PIX." no desktop, "Aceite os termos para pagar." no celular).
  - `adapt`: no celular o texto e o link formavam três linhas e a barra crescia de 69 para 101 px; o aviso virou um controle só (o próprio texto é o atalho), com alvo de 44 px por margem negativa, e a barra ficou em 69 px também em 320 px.
  - `typeset`: a linha de apoio do desktop tem o mesmo corpo da linha de segurança logo abaixo.
  - `colorize`: o atalho usava o laranja da marca, que dá 2,89:1 em texto pequeno; agora usa o primeiro plano e é sublinhado (17,86:1).
  - `polish`: tela real vista em 1440, 375 e 320 px.
- [x] F11.G5: tela real renderizada (`/checkout`, dados da API local).
  - EVIDENCE: 1440 px, botão "Gerar QR Code PIX" desabilitado (opacidade 0,5) com a linha "Aceite os termos para gerar o QR Code PIX." acima (contraste 4,83:1) e `aria-describedby`; a caixa tem `aria-required="true"`; marcar habilita o botão e some a linha; desmarcar bloqueia de novo. 375 px: "Continuar" habilitado na primeira fase; na última, o botão da barra desabilitado e o atalho "Aceite os termos para pagar." (44 px de altura) leva a caixa à vista e a foca; marcar libera o botão e o atalho some. 320 px: sem rolagem horizontal, sem sobreposição entre atalho e botão. Enter num campo com a caixa desmarcada: sem envio, sem erro, sem troca de fase.
- [x] F11.G6: fase do cartão e retry de pagamento, em 2026-11-26.
  - EVIDENCE: o catálogo local não oferece cartão (sem chave pública do AbacatePay), então usei um spec descartável do Playwright com as opções, a adesão e o `abacatepay.js` interceptados (campo de cartão simulado, sem rede e sem dados de cartão). Apagado depois.
    - Desktop: com 3 fases no stepper, a fase "Dados do cartão" mostra o campo, as parcelas e o resumo no cartão; a caixa desmarcada deixa "Pagar com cartão" desabilitado, com a linha "Aceite os termos para pagar com cartão." acima; marcar libera.
    - Celular (375 px): "Passo 3 de 3: Dados do cartão"; o botão da barra fica desabilitado e o atalho "Aceite os termos para pagar." leva à caixa e a foca; marcar libera.
    - Retry: depois da recusa simulada do cartão ("Não conseguimos aprovar o cartão"), "Corrigir dados do cartão" volta ao formulário com o pedido existente: a caixa dos termos não aparece, nenhum aviso de termos aparece e "Tentar pagar de novo" fica habilitado. Igual no desktop e no celular.
    - Console: só o 404 do CNPJ e o 400 da recusa, ambos simulados, mais o log do próprio app para o pagamento recusado. Nenhum erro de página.
  - Outros navegadores e E2E reexecutados (todos com dados simulados ou banco local): ver `06-fase-c-renovacao.md`.
  - NÃO verificado: tokenização real contra o AbacatePay (o campo foi simulado); toque em aparelho físico; leitor de tela; WebKit (ver `06-fase-c-renovacao.md`).

## F4. Página de assinatura restrita a master e delegados (Fase E)

**Estado:** não verificado. Precisa ler `app/[supabaseId]/subscription/features/container/SubscriptionContainer.tsx` e a rota de `subscription-management`.

- [ ] F4.G1: página oculta para quem não é master nem tem `canManageAccountTeams`, no cliente e na API.
  - EVIDENCE: pendente.
- [ ] F4.G2: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F5. Dialog "Marcar como paga externamente" (Fase D)

**Estado:** não iniciado. Exclusivo do backoffice. Reaproveita o item de menu "Confirmar recebimento em dinheiro" como ponto de entrada.

- [ ] F5.G1: dialog pede referência e comprovante, e chama a rota nova da Fase D.
  - EVIDENCE: pendente.
- [ ] F5.G2: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F6. Padronização visual das ações de fatura (Fase G)

**Estado:** não iniciado. Usa `design-system-guard`.

- [ ] F6.G1: botões de Cancelar e Marcar paga externamente seguem o design system.
  - CHECK: `bun run design:check`
  - EVIDENCE: pendente.

## F7. Tokenização do cartão no checkout de add-on (decisão D1)

**Estado:** decidido, não implementado. Solicitação desta data: apenas documentar.

**Referência já existente no `develop`:** `app/adesao/[token]/features/components/AbacateCardField.tsx`. O componente carrega o `abacatepay.js`, chama `AbacatePay.create` com `onCardChange` (que devolve `canTokenize`) e expõe `tokenize` para o clique. A adesão já envia o `ctok_` ao servidor (`adhesionCheckoutInput.ts`, linha 21).

**Fluxo alvo para o add-on:**
1. O componente monta o formulário do cartão no navegador, com a chave pública (`pk_...`). A chave pública pode ir ao frontend. A chave de API não.
2. O botão "Pagar" fica liberado só quando `canTokenize` é verdadeiro.
3. No clique, o navegador chama `tokenize` e recebe `ctok_...` (60 s, uso único).
4. O navegador envia só o `ctok_` e os dados do cliente ao backend. O número e o CVV nunca passam pelo servidor.
5. O backend chama `/v2/transparents/create` com `method: CARD`, o `ctok_` e o `customer`.
6. O `cardToken` permanente devolvido pelo AbacatePay pode ser salvo para cobrança futura, sem novo pedido do cartão. Esse token não é o número do cartão.

- [ ] F7.G1: formulário do add-on reutiliza `AbacateCardField` e envia só `ctok_`.
  - EVIDENCE: pendente.
- [x] F7.G2: campo `creditCard` (número e CVV) removido do contrato de `POST /api/v1/addon-checkout/[pendingActionId]/pay`. Feito no backend.
  - EVIDENCE: ver B3.G6. O front ainda precisa parar de enviar o cartão (F7.G1).
- [ ] F7.G3: briefing `impeccable shape`, validação no navegador e revisão `impeccable`.
  - EVIDENCE: pendente.

## F8. Telefone obrigatório no cadastro (usuário adicional e nova adesão)

**Briefing:** `design/telefone-obrigatorio-cadastro.md` (aprovado em 2026-11-24).

- [x] F8.G1: `UserFormDialog` pede "Telefone" no modo criar; `BackofficeAdhesionDialog` exige telefone ao criar adesão.
  - CHECK: `e2e/specs/product/manager-users-phone.spec.ts` (vermelho sem o campo, verde com ele); `BackofficeAdhesionService.selfCheckout.test.ts` ("create() recusa nova adesão sem telefone").
  - EVIDENCE: verificação renderizada em 375 px e 1280 px no stack em container (campo com 44 px no celular, erro no próprio campo). O E2E achou que `useManagerUsers` montava o corpo sem `phone`; corrigido.
- [x] F8.G2: sequência `impeccable` em `UserFormDialog.tsx`, um passo por vez (2026-11-24).
  - harden: achou e corrigiu dois defeitos. (1) `autoComplete="tel"` preencheria o telefone de quem está logado como se fosse o do convidado; agora `off`. (2) Digitar o 12º dígito num número completo trocava o DDD, porque `maskPhone("(11) 99999-88887")` devolve `(19) 99998-8887`; `applyPhoneInput` em `lib/masks.ts` ignora a digitação além de 11 dígitos e mantém a colagem de `+55…` normalizada. Teste unitário vermelho antes (função inexistente) e verde depois; o E2E digita o dígito extra e confere o valor e o atributo.
  - clarify: rótulo, ajuda e placeholder seguem o padrão dos campos vizinhos. Divergência para decisão, não aplicada: "Telefone inválido" não diz como corrigir; sugestão "Informe DDD e número, ex.: (11) 99999-9999." (o texto atual foi o aprovado no briefing). Terminologia: a mensagem do servidor na criação de adesão diz "Celular", como as demais mensagens daquele serviço, e a tela diz "Telefone".
  - adapt: 375 px e 1280 px renderizados; campo com 44 px no celular (`max-lg:h-11`), `type="tel"` com teclado numérico, sem dependência de hover. E2E mede fonte computada ≥ 16 px (sem zoom do Safari no foco). Evidência é viewport emulado em Chromium; aparelho real e Safari não foram testados.
  - typeset: `impeccable detect --json --scope type` nos dois arquivos devolveu `[]`. O campo usa as classes do `Input`, do `FormLabel` e do `FormDescription` dos vizinhos; nenhuma família, peso ou tamanho novo.
  - colorize: nenhuma cor nova. Estado de erro usa os tokens `destructive` do `Form*` (rótulo, borda e mensagem) e o erro também é texto, então não depende só de cor. O contraste do placeholder é do `Input` compartilhado e não foi medido aqui.
  - polish: foco visível (anel do `--ring`) e erro no próprio campo conferidos nos prints; sem código de depuração; diff final sem churn. Diálogo de adesão do backoffice não foi renderizado (precisa de lead elegível): a mudança nele é o asterisco do rótulo e a regra do botão.
  - Limite: o detector roda só por regex nos `.tsx` (sem DOM renderizado autenticado); regras de elemento (contraste, tiny-text) não rodaram.

## F9. Telefone do cliente na Nova Cobrança (backoffice)

**Briefing:** `design/cobranca-avulsa-backoffice.md`, seção 10 "Telefone do cliente" (aprovado por instrução do dono em 2026-11-24, antes do JSX).

- [x] F9.G1: campo "Telefone do cliente *" aparece só quando o cliente selecionado não tem telefone; valida com `registrationPhoneError`; vai só com dígitos no POST; o backend valida de novo, usa o número na criação do cliente no provedor e salva no cadastro.
  - CHECK: `BackofficePaymentUseCase.abacatePay.test.ts` (13 testes: sem telefone no cadastro nem no corpo recusa com "Telefone é obrigatório"; inválido recusa com "Telefone inválido"; informado salva e cobra; cadastro com telefone não pede nem sobrescreve); `BackofficePaymentUseCase.cardGuard.test.ts` (2); `app/api/v1/backoffice/payments/route.test.ts` (2).
  - CHECK: `e2e/specs/backoffice/payments.spec.ts` lista 9 testes (`playwright test --list`, exit 0). O teste novo "Nova Cobrança: telefone só aparece sem cadastro…" cobre: campo só sem telefone, obrigatório, inválido, foco no campo, payload só com dígitos e o campo sumir depois de salvo. Execução: NÃO verificado (ver F9.G3).
- [x] F9.G2: `impeccable detect` no `BackofficePaymentsContainer.tsx` devolveu `[]`. Revisão de harden, clarify, adapt, typeset, colorize e polish feita no código: tokens e componentes dos campos vizinhos (`Input`, `Label`, `max-lg:h-11`), `type="tel"`, `inputMode="tel"`, `autoComplete="off"`, erro em `role="alert"` com `aria-invalid` e `aria-describedby`, `text-destructive`. Nenhuma cor, família ou tamanho novo. Divergências para decisão: nenhuma.
- [ ] F9.G3: verificação renderizada em 375 px e 1280 px (browser-harness), estados vazio, carregando e erro, console limpo e foco visível: NÃO verificado. O stack de testes em container não foi subido nesta rodada e a tela exige sessão de backoffice com cliente sem telefone.
- Comandos desta rodada:
  - `bun run design:check`: exit 0.
  - `bun run lint:pt-br:strict`: exit 0 (1259 arquivos).
  - `bun run typecheck`: NÃO concluído nesta rodada. A execução ficou na fila por outros `tsc` do mesmo worktree (máquina com 27 GB de 30 em uso) e não gravou código de saída até o registro. Pendente: repetir e ler o EXIT.

## F12. Botão "Regularizar assinatura" no painel "Acesso não liberado" (regularização do master, D18)

**Estado:** implementado em 2026-11-25 (`039ba5d15`) e mergeado.

**Briefing:** [design/regularizar-assinatura-painel-bloqueado.md](design/regularizar-assinatura-painel-bloqueado.md), aprovado em 2026-11-25.

**Arquivos:** `app/[supabaseId]/components/FeatureBlockedPanel.tsx` (painel e botão), `accountAccessRecovery.ts` (`canOfferPaymentFromBlockedFeature`, `getPaymentRecoveryHref`), `LayoutContent.tsx` (uso).

- [x] F12.G1: a regra e a marcação do painel com e sem botão estão cobertas por teste.
  - CHECK: `bun test --isolate --preload ./test/setup-happy-dom.ts "app/[supabaseId]/components"`
  - EVIDENCE: 0 falhas em 2026-11-26 (142 testes no conjunto de componentes, checkout e add-on), incluindo `FeatureBlockedPanel.test.tsx`.
- [x] F12.G2: tela vista no navegador com a conta de teste em carência, em 1280 e 375 px, e o clique leva à página de pagamento.
  - EVIDENCE: prints enviados no chat em 2026-11-25 e 2026-11-26. O clique levou a `/billing-grace-payment` (2026-11-25) e depois a `/pagamento/[supabaseId]` (2026-11-26, depois da D15), onde a página "Renove sua assinatura" renderizou.
- [ ] F12.G3: revisão `impeccable` completa.
  - EVIDENCE: pendente. Só o detector automático rodou, sem achados.
- [ ] F12.G4: leitor de tela e WebKit.
  - EVIDENCE: Não verificado.

## F13. Checkout em tela própria e confirmação com contador (D15, D16 e D17)

**Estado:** implementado em 2026-11-26 (`1e6a8a88c`, `572020153`, `38595f69a`) e mergeado (PR #1431).

**Briefing:** [design/checkout-pagamento-dedicado.md](design/checkout-pagamento-dedicado.md), aprovado em 2026-11-26.

**Arquivos:** `app/pagamento/[supabaseId]/layout.tsx` e `page.tsx` (layout sem sidebar e checagem de dono), `components/checkout/CheckoutAccountHeader.tsx` (cabeçalho com "Sair"), `components/checkout/CheckoutAutoRedirect.tsx` (contador de 5 s e "Ir agora"), `components/checkout/CheckoutSuccess.tsx` (variantes `renewal` e `addon`), `components/public-checkout/PublicCheckoutFlow.tsx` (`successHref`), `app/addon-checkout/[pendingActionId]/page.tsx` e `AddOnCheckoutContainer.tsx` (login e destino).

- [x] F13.G1: o contador começa em 5 s, oferece "Ir agora" e não tem botão de cancelar.
  - CHECK: `bun test --isolate --preload ./test/setup-happy-dom.ts components/checkout`
  - EVIDENCE: 19 testes, 0 falhas em 2026-11-26, incluindo `CheckoutAutoRedirect.test.tsx` (contagem e ausência de "Cancelar").
- [x] F13.G2: checkout de regularização visto no navegador sem sidebar, com cabeçalho e "Sair", em desktop e em 375 px; a confirmação mostra o contador e redireciona ao dashboard.
  - EVIDENCE: prints enviados no chat em 2026-11-26. O pagamento foi **simulado** no navegador (troca de `fetch` só para as chamadas do checkout, sem cobrança real). A contagem terminou em `/a343224a-.../dashboard`. Um defeito de margem lateral encontrado nessa verificação foi corrigido no layout.
- [x] F13.G3: o alvo de toque do "Sair" tem 44 px no celular.
  - EVIDENCE: a pipeline do PR #1431 reprovou o teste de responsividade do spec de regularização ("Sair" com 32 px em 360 px); corrigido com `max-lg:min-h-11` em `38595f69a`.
- [ ] F13.G4: E2E de regularização e de add-on verdes depois da última correção.
  - CHECK: `e2e/specs/product/billing-grace-payment.spec.ts` e `e2e/specs/checkout/addon-checkout.spec.ts`
  - EVIDENCE: Não verificado por mim. No run 45840803886 (commit `572020153`) restaram 2 falhas: o alvo de toque do "Sair" (corrigido) e `templates-flow.spec.ts` (landing pages, instabilidade fora desta feature). O resultado depois de `38595f69a` não foi lido; o PR foi mergeado em seguida.
- [ ] F13.G5: confirmação do add-on com pagamento confirmado de verdade.
  - EVIDENCE: pendente. Precisa de uma cobrança de add-on real no banco local ou no sandbox.
- [ ] F13.G6: cabeçalho com "Sair" no add-on e revisão `impeccable` completa.
  - EVIDENCE: pendente. O add-on manteve o cabeçalho do `PublicCheckoutShell` (D16).
