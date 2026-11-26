# Briefing: checkout de regularização e de add-on em tela própria

**Status:** aprovado pelo dono em 2026-11-26, com três escolhas: rota `/pagamento/[supabaseId]`, login obrigatório também no add-on e redirecionamento ao app depois do pagamento. Decisões em [05-decisoes.md](../05-decisoes.md) (D15, D16 e D17).

**Desvio registrado depois da aprovação:** o briefing dizia "destino: entrada da conta (`/[supabaseId]`)". Essa raiz não tem página, então o destino implementado é `/[supabaseId]/dashboard`, o mesmo que a tela de renovação já usava. O botão "Cancelar" do redirecionamento, previsto numa primeira versão, foi retirado a pedido do dono em 2026-11-26.

## Superfície

Checkout autenticado, fora do shell da conta. Modo **Operate**: o master precisa concluir um pagamento sem a navegação do produto ao redor.

## Estado atual (antes)

A regularização abria em `/[supabaseId]/billing-grace-payment`, dentro do layout da conta, com a sidebar. O add-on (`/addon-checkout/[pendingActionId]`) já ficava fora do layout da conta, mas era público (sem login).

## Usuário

O master da conta, vindo do botão "Regularizar assinatura", do banner de vencimento, do modo somente leitura, da página de assinatura ou do e-mail de inadimplência. No add-on, o usuário que contrata o item.

## Direção

- **Estrutura:** sem sidebar. Cabeçalho enxuto com logo, "Corretor Studio" e "Sair" (`components/checkout/CheckoutAccountHeader.tsx`). O conteúdo é o checkout que já existia: fase 1 "Plano e itens", fase 2 "Pagamento", resumo à direita no desktop e barra fixa no celular.
- **Login:** a rota exige sessão. Sem sessão, vai ao login e volta para a mesma URL (`/sign-in?next=...`). Na regularização, só o dono da conta vê o checkout; os demais voltam ao próprio dashboard.
- **Rotas:** regularização em `/pagamento/[supabaseId]` (a rota antiga responde 308). Add-on em `/addon-checkout/[pendingActionId]`, agora com login.
- **Margens:** o layout repõe a margem lateral (`px-4 sm:px-6 lg:px-8`) que a sidebar fornecia antes.
- **Alvo de toque:** "Sair" com 44 px de altura abaixo de `lg` (`max-lg:min-h-11`).
- **Confirmação final:** "Assinatura reativada" (renovação) ou "Pagamento confirmado" (add-on), com "Você será levado ao Corretor Studio em N s." e o botão "Ir agora". Contagem de 5 s, depois navegação completa para `/[supabaseId]/dashboard`. Sem botão de cancelar. Componente `components/checkout/CheckoutAutoRedirect.tsx`.

## Estados

Carregando, cotação, erro de cotação, pagamento recusado, PIX expirado e sucesso. Todos já existiam no fluxo; muda o contêiner e a tela final.

## Reuso

`CheckoutSuccess` (variantes `renewal` e `addon`), `PublicCheckoutFlow`, os componentes de `components/checkout/` e `getServerSessionUserId` (`lib/supabase/server-session-user.ts`).

## Fora do escopo

Preço, cobrança e conteúdo dos planos. O cabeçalho com "Sair" não foi aplicado ao add-on, que manteve o cabeçalho do `PublicCheckoutShell`.

## Verificação

- Regularização vista no navegador em desktop e em 375 px, com a conta de teste em carência (prints enviados no chat em 2026-11-26). A confirmação foi vista com o pagamento simulado no navegador (sem cobrança real): contador de 5 s e redirecionamento ao dashboard.
- E2E atualizados: `e2e/specs/product/billing-grace-payment.spec.ts` (inclui sem sessão, dono e não dono) e `e2e/specs/checkout/addon-checkout.spec.ts`.
- Não verificado: confirmação do add-on com pagamento confirmado de verdade, WebKit e leitor de tela.
