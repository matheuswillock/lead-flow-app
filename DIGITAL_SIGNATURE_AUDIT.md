# Audit: Assinatura Digital do Aceite (Primeiro Acesso)

**Data:** 2026-07-12
**Escopo:** fluxo pagamento → assinatura digital dos 3 documentos (Termos de Uso, Política de Privacidade, Contrato de Licença) → criação de senha → primeiro acesso.
**Referência de UX:** mockup estático `Primeiro_Acesso.html` (fora do repo, `~/Downloads`).
**Veredito geral:** o backend de assinatura digital é **greenfield completo** (itens 1–5, 7 e 8 abaixo: não existem). O que existe e é aproveitável é a espinha dorsal do fluxo de contratação (webhook Asaas → adesão → criação de conta → convite de senha), a infra de e-mail transacional Resend e o padrão de Storage.

---

## 1. Estado atual do fluxo de contratação (aproveitável)

### 1.1 Pagamento confirmado → criação de conta (existe — ponto de disparo confirmado)

Cadeia completa, já em produção:

1. `app/api/webhooks/asaas/route.ts` — entrypoint do webhook (valida `asaas-access-token`).
2. `app/api/webhooks/asaas/processAsaasWebhookEvent.ts:117-134` — para todo `payment.id`, chama `backofficeAdhesionUseCase.processPaymentWebhook(event, payment, { deferEmailDelivery: true })`.
3. `app/api/services/backofficeAdhesion/BackofficeAdhesionService.ts:918-983` (`processPaymentWebhook`) — resolve a adesão via `asaasPaymentId` ou `externalReference` `backoffice-adhesion-<id>`; se pago, marca `status: "paid"` e chama `ensureAccountForPaidAdhesion`.
4. `BackofficeAdhesionService.ts:1279-1445` (`ensureAccountForPaidAdhesion`) — **é aqui que o link de assinatura deve ser disparado**. Hoje o método:
   - gera o convite Supabase (`supabaseAdmin.auth.admin.generateLink({ type: "invite", redirectTo: getFullUrl("/set-password"), data: { first_access: true } })`);
   - cria o `Profile` do Manager pago (`repo.createPaidManagerProfile`), ativa assinatura, marca `markAccountCreated`;
   - envia o e-mail de definição de senha via `sendSetPasswordEmail` (`BackofficeAdhesionService.ts:1587-1638`) → `EmailService.sendAdhesionCompletedEmail` (`lib/services/EmailService.ts:1051`).
   - é idempotente por `adhesion.createdSupabaseId || adhesion.createdProfileId` (early return) — padrão a replicar no aceite.

**Conclusão:** hoje o usuário vai de "pagamento confirmado" direto para "criar senha", **sem nenhuma etapa de aceite de documentos**. O gancho natural da nova etapa é dentro de `ensureAccountForPaidAdhesion`, trocando o e-mail de set-password por um e-mail de "revise e aceite os documentos" que só leva ao set-password após o aceite.

### 1.2 Dados já coletados na contratação (pré-preenchimento do formulário)

`BackofficeAdhesion` (`prisma/schema.prisma:1073-1140`) já tem: `fullName`, `email`, `phone`, `cpfCnpj` (11 **ou** 14 dígitos — pode ser CNPJ), endereço completo (`postalCode`…`state`), ciclo, valores, `asaasCustomerId/PaymentId`, `paidAt`, `createdProfileId/createdSupabaseId`.

**Não existem hoje:** razão social, nome fantasia, cargo do representante, CPF do representante separado do CNPJ da empresa. Ou seja, do formulário do mockup: `email`, `whatsapp` e possivelmente `cnpj` vêm pré-preenchidos da adesão; `razão social`, `nome fantasia`, `nome do representante`, `CPF` e `cargo` são coletados na tela de aceite.

### 1.3 Token público da adesão

A adesão já tem fluxo de página pública por token (`tokenHash`/`tokenPreview`/`expiresAt`, `getPublicUrl`/`getPublicDetails` em `BackofficeAdhesionService.ts:748-797`), **mas** `invalidateTokenAfterPayment` (`BackofficeAdhesionService.ts:985-993`) expira o token no pagamento. A página de aceite (pós-pagamento) precisará de **token próprio** — o padrão hash+preview+expiração já existente é o modelo a replicar.

---

## 2. Classificação dos 8 itens do estado-alvo

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | Termos versionados no banco, geridos pelo Backoffice | **não existe** | Nenhum model no `prisma/schema.prisma` (grep `legal/terms/aceite/acceptance` → só `contractDueDate`). Termos hardcoded em JSX em `app/terms/page.tsx`, `app/privacy-policy/page.tsx`, `app/cookies/page.tsx` (landing) e em JSON embutido no mockup. |
| 2 | Formulário de dados da contratação | **parcial** | Campos/máscaras/validações existem só no mockup estático (client-side, `Primeiro_Acesso.html:759-798`). No backend, `BackofficeAdhesion` cobre parte dos dados (1.2 acima); razão social/cargo/CPF do representante não existem em lugar nenhum. |
| 3 | Tabela de log de assinatura com evidências (protocolo, IP, UA, hash, PDF path), imutável | **não existe** | Nenhuma tabela; o mockup grava em `localStorage` (`Primeiro_Acesso.html:941`) e gera protocolo com hash fraco em JS (`gerarProtocolo`, linha 811-816). |
| 4 | Geração de PDF server-side | **não existe** | PDF gerado no client com jsPDF via CDN (`Primeiro_Acesso.html:628`, `gerarPDF` linhas 819-908). **Nenhuma lib de PDF no `package.json`** (sem pdf-lib, @react-pdf/renderer, pdfkit, puppeteer) e **não há skill de PDF no diretório `skills/` do projeto** — a escolha da lib é decisão arquitetural da spec. |
| 5 | Envio de e-mail com os documentos | **não existe (infra existe)** | Nenhum template/método de "aceite concluído + PDF". A infra transacional está pronta: `lib/services/EmailService.ts` (Resend, idempotency key, suporte a `Attachment` do SDK do Resend, logging via `lib/email/log-profile-email-dispatches.ts`) — **separada** do módulo de campanhas (`app/api/services/EmailCampaignDispatch/`). Pergunta bloqueante (c) resolvida: reutilizar `EmailService`. |
| 6 | Criação de senha e primeiro acesso | **existe** | Convite nativo Supabase (`generateLink type: "invite"`) + tela customizada `app/set-password/page.tsx` (605 linhas) já em produção. Pergunta bloqueante (b) resolvida: reaproveitar; a novidade é apenas condicionar o acesso ao set-password à conclusão do aceite. |
| 7 | Visibilidade no Backoffice ("Primeiro Acesso") | **parcial** | Não é uma tela dedicada: é um bloco "Acesso à plataforma" com badge "Primeiro acesso concluído / Convite pendente" em `app/backoffice/(app)/clients/all-users/features/components/BackofficeAllUsersDetailSheet.tsx:193-220` e `app/backoffice/(app)/clients/[masterId]/features/components/BackofficeMemberProfileSheet.tsx`, derivado de `last_sign_in_at` do Supabase (`lib/backoffice-member-access.ts:28-32`, status `pending_first_access`). É o padrão visual/arquitetural onde as infos de aceite devem ser expostas. Nada sobre termos/protocolo/PDF existe. |
| 8 | Testes + mockups | **não existe** | Zero testes (não há código). Padrão de teste a seguir existe (ex.: `app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase.test.ts`, `lib/email/*.test.ts`). |

---

## 3. Aproveitável (inventário)

- **Fluxo de adesão completo** (webhook → conta → convite): itens 1.1–1.3.
- **E-mail transacional:** `lib/services/EmailService.ts` (2.384 linhas; Resend com idempotência e anexos) — item 5.
- **Supabase Storage:** padrão de bucket em `app/api/services/LeadAttachment/LeadAttachmentService.ts` (upload, signed/public URL, remove) — modelo para o bucket de PDFs de aceite.
- **Badge "Primeiro acesso" no Backoffice** — item 7.
- **Padrão token público** (hash + preview + expiração) da adesão — para o link de aceite.
- **Governança de módulo backoffice** (tabelas `Backoffice*`, rotas `app/api/v1/backoffice/**`, `getBackofficeAccess()`) — a gestão de documentos e o log de aceite pertencem a este módulo.
- **Conteúdo legal do mockup** — os 3 documentos completos no JSON do mockup servem de **conteúdo semente (versão 1.0)** para a migration de dados.
- **UX do mockup** — tabs, gate de scroll, checkbox por documento, declaração final, formulário com máscaras (CNPJ/CPF/telefone), tela de sucesso: especificação de experiência pronta para adaptação ao design system.

## 4. Não aproveitável (do mockup — confirmação dos 4 pontos)

1. **Termos hardcoded** no `<script type="application/json">` (linhas 317-627) — vão para o banco como seed, nunca para o código da página.
2. **jsPDF no client** (CDN, linha 628; `gerarPDF` 819-908) — a *estrutura* do PDF (capa + identificação das partes + documentos na íntegra + declaração + evidências + header/footer com protocolo) é ótima especificação e deve ser reproduzida server-side; o código, não.
3. **`gerarProtocolo`** (hash numérico de 32 bits, linhas 811-816) — fraco e adivinhável; substituir por geração no servidor com `node:crypto`.
4. **`localStorage` + e-mail prometido e nunca enviado** (linhas 941, 303-306) — a tela de sucesso afirma "Enviamos para seu e-mail…" sem backend; vira rota real + Resend.

---

## 5. CRITIQUE — riscos e achados além dos 8 itens

1. **Termos hardcoded também na landing** (`app/terms/page.tsx`, `app/privacy-policy/page.tsx`): quando os documentos forem versionados no banco, a landing passa a poder divergir da versão vigente aceita no onboarding. Risco jurídico: usuário aceita a versão X do banco enquanto o site público mostra a versão Y hardcoded. A spec deve pelo menos registrar a unificação como estágio ou non-goal explícito.
2. **Ordem do fluxo hoje "vaza" o set-password:** o invite link é gerado e enviado no momento do pagamento. Se a etapa de aceite for adicionada apenas como "mais um e-mail", o usuário pode definir senha e entrar na plataforma **sem nunca aceitar os termos**. O gate precisa ser estrutural (aceite antes do envio do link de senha e/ou verificação no middleware), não só de navegação.
3. **`cpfCnpj` ambíguo na adesão:** o campo aceita 11 ou 14 dígitos e hoje representa o comprador. No aceite, CNPJ (empresa) e CPF (representante) são entidades distintas — não sobrescrever o campo da adesão; gravar ambos no log de aceite.
4. **Imutabilidade não é default:** Prisma/Supabase permitem UPDATE/DELETE por padrão; sem trigger de bloqueio + RLS, "log imutável" é só convenção. Precisa de migration manual (trigger `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`) — nunca via SQL Editor.
5. **Bucket de Storage:** `LeadAttachmentService` usa `getPublicUrl` em bucket de anexos. PDFs de aceite contêm CPF/CNPJ/endereço — o bucket **deve ser privado**, com signed URLs de curta duração, tanto no e-mail (anexo preferível a link público) quanto no Backoffice/Account.
6. **Republicação de versão:** publicar nova versão de documento não pode alterar aceites passados — resolvido por log com `documentVersion` + `documentContentHash` por documento; mas atenção para o front **nunca** cachear a versão ativa além do load da página (aceitar exatamente o que foi exibido: o POST deve referenciar os IDs de versão carregados, e o servidor deve validar que ainda são os vigentes ou registrar exatamente os enviados/exibidos).
7. **Mistura transacional × marketing:** não detectada — `EmailService` (transacional) e `EmailCampaignDispatchService` (campanhas) já são serviços separados. Manter o e-mail de aceite no `EmailService`.
8. **Sem lib de PDF no projeto e produção em Vercel/Node:** proibido `Bun.*` em `app/**`/`lib/**`; Puppeteer/Chromium é pesado demais para function Vercel. A escolha (recomendação: `@react-pdf/renderer`, renderização server-side em Node, coerente com o uso de React Email no projeto) precisa constar como decisão na spec.
9. **`deferEmailDelivery: true` no webhook:** o e-mail pós-pagamento é disparado com `void ...catch` (fire-and-forget, `BackofficeAdhesionService.ts:1429-1438`). Se o e-mail de aceite falhar, o usuário fica pago e sem link. O Backoffice precisa de reenvio manual (já existe `resendInvite` na adesão — estender o padrão para o link de aceite).
10. **Geração do PDF no request de aceite:** montar PDF de ~20 páginas + upload + e-mail dentro do POST de aceite pode estourar timeout. Persistir o log primeiro (fonte de verdade), e gerar PDF/e-mail de forma tolerante a retry (idempotente, re-executável), nunca perdendo o aceite se o PDF falhar.

## 6. Perguntas bloqueantes — status

- **(a) Ponto de disparo:** respondida pelo código — `ensureAccountForPaidAdhesion` (§1.1). Não bloqueia.
- **(b) Criação de senha:** respondida — invite Supabase + `/set-password` customizada já existem e serão reaproveitadas. Não bloqueia.
- **(c) E-mail transacional separado de campanhas:** respondida — separação já existe (`EmailService` vs `EmailCampaignDispatch`). Não bloqueia.
