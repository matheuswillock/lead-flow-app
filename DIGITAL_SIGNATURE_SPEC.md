# Spec: Assinatura Digital do Aceite — Termos versionados, Log probatório e PDF server-side

**Data:** 2026-07-12
**Base:** `DIGITAL_SIGNATURE_AUDIT.md` (mesma rodada). Seções citadas (ex.: §1.1) referem-se ao audit.
**Status:** não implementado (greenfield, exceto fluxo de adesão existente).
**UX de referência:** mockup `Primeiro_Acesso.html` — reaproveitar a experiência (tabs, gate de scroll, checkboxes, formulário, tela de sucesso), **não** o CSS, o JSON embutido, o jsPDF nem o protocolo client-side.

---

## Background

Hoje o fluxo de contratação vai de "pagamento confirmado no Asaas" direto para "criar senha" (`ensureAccountForPaidAdhesion`, §1.1), sem nenhuma etapa de aceite de Termos de Uso, Política de Privacidade e Contrato de Licença. O mockup anexado resolve UX e texto-base, mas é 100% client-side (termos em JSON no HTML, PDF via jsPDF, protocolo por hash fraco, persistência em `localStorage`). Este spec define a versão com valor probatório: documentos versionados no banco geridos pelo Backoffice, log de aceite imutável com evidências (IP, user-agent, versão, hash de conteúdo, protocolo), PDF gerado no servidor e salvo em Supabase Storage, e-mail transacional via Resend, e gate estrutural: sem aceite, sem senha, sem plataforma.

## Goals

1. **Termos versionados no banco** (`BackofficeLegalDocument`), com tela de gestão no Backoffice; a página de aceite sempre carrega a versão ativa — zero texto legal hardcoded.
2. **Log de aceite imutável** (`BackofficeTermsAcceptance`): 1 registro por assinatura completa, com protocolo gerado no servidor, IP, user-agent, `acceptedAt`, e por documento: tipo, versão e hash SHA-256 do conteúdo exato aceito; imutável via trigger Postgres.
3. **PDF server-side** em Service dedicado (capa + 3 documentos na íntegra com identificação das partes + declaração de aceite + evidências, como o mockup monta), salvo em bucket **privado** do Storage, path no log.
4. **E-mail transacional** (Resend via `EmailService`) com o PDF ao concluir o aceite.
5. **Gate estrutural:** o link de set-password só é entregue após o aceite; contas pagas pós-feature não acessam a plataforma sem aceite registrado.
6. **Visibilidade:** Backoffice vê status/versões/protocolo/PDF do aceite por conta (no mesmo padrão do bloco "Acesso à plataforma", §2 item 7); o próprio usuário rebaixa seu comprovante na tela Account.
7. **Testes obrigatórios** em todo estágio: hash determinístico, idempotência do aceite (1 log por adesão), unicidade do protocolo.

## Non-Goals

- Assinatura com certificado digital ICP-Brasil ou provedores externos (Clicksign/D4Sign) — o aceite eletrônico com evidências (MP 2.200-2/2001) é o escopo.
- Re-aceite forçado de usuários **existentes** quando uma nova versão é publicada (fluxo cobre contas novas pós-pagamento; re-aceite de base instalada é rodada futura).
- Redigir o texto jurídico — o conteúdo do mockup entra como versão 1.0 via seed; edição é do negócio.
- Editor rich-text/WYSIWYG no Backoffice — editor estruturado simples (blocos) nesta rodada.
- Unificar `app/terms` / `app/privacy-policy` da landing com as versões do banco (registrado como follow-up; ver CRITIQUE #1 do audit).
- Aceite para operadores/membros convidados pelo Manager (só o fluxo de contratação do Manager pago via adesão).

---

## Decisões arquiteturais

### D1 — Módulo: entidades no domínio Backoffice

Tabelas `backoffice_legal_documents` e `backoffice_terms_acceptances`, código em `app/api/services/backofficeLegalDocuments/` e `backofficeTermsAcceptance/`, rotas de gestão em `app/api/v1/backoffice/**`. **Justificativa:** a gestão é do Backoffice, o aceite referencia `BackofficeAdhesion`, e a governança exige prefixo `Backoffice*` para entidades novas do módulo. O único acoplamento com o produto é `profileId` (coupling permitido) para o usuário rebaixar o comprovante na tela Account.

### D2 — Estrutura da tabela de documentos versionados

```prisma
enum BackofficeLegalDocumentType {
  terms
  privacy
  contract
}

model BackofficeLegalDocument {
  id          String                      @id @default(uuid()) @db.Uuid
  type        BackofficeLegalDocumentType
  version     String                      @db.Text          // ex: "1.0", "2026-05-30"
  title       String                      @db.Text
  content     Json                        // blocos estruturados (ver abaixo)
  contentHash String                      @map("contentHash") @db.Text // sha256 canônico, calculado no publish
  isActive    Boolean                     @default(false)
  publishedAt DateTime?                   @db.Timestamptz(6)
  createdByBackofficeUserId String?       @db.Uuid
  createdAt   DateTime                    @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime                    @updatedAt @db.Timestamptz(6)

  @@unique([type, version])
  // partial unique index (migration manual): só 1 isActive=true por type
  @@map("backoffice_legal_documents")
}
```

`content` = array de blocos `{ kind: "meta" | "heading" | "subheading" | "paragraph" | "listItem" | "romanItem", text: string }` — mesma capacidade de estruturação que o renderizador do mockup (`renderDoc`) já usa; renderiza igual na página e no PDF. Rascunho (`isActive=false`, `publishedAt=null`) é editável; **publicado é congelado** (novo texto = nova versão). Publicar a versão N ativa-a e desativa a anterior na mesma transação; aceites antigos não mudam (referenciam versão+hash no log, D3).

### D3 — Estrutura do log de assinatura

```prisma
model BackofficeTermsAcceptance {
  id                 String   @id @default(uuid()) @db.Uuid
  adhesionId         String   @unique @db.Uuid   // ⇒ idempotência: 1 aceite por contratação
  profileId          String?  @db.Uuid           // preenchido quando o Profile já existe
  protocol           String   @unique @db.Text   // gerado no servidor (D5)
  ip                 String   @db.Text
  userAgent          String   @db.Text
  locale             String?  @db.Text
  acceptedAt         DateTime @db.Timestamptz(6)
  // dados da contratação declarados no aceite (snapshot, não FK)
  companyLegalName   String   @db.Text
  companyTradeName   String?  @db.Text
  companyCnpj        String   @db.Text
  representativeName String   @db.Text
  representativeCpf  String   @db.Text
  representativeRole String   @db.Text
  representativeEmail String  @db.Text
  representativeWhatsapp String @db.Text
  // evidência por documento (3 linhas)
  documents          BackofficeTermsAcceptanceDocument[]
  pdfStoragePath     String?  @db.Text           // nulo até o PDF ser gerado (D6/estágio de retry)
  pdfGeneratedAt     DateTime? @db.Timestamptz(6)
  emailSentAt        DateTime? @db.Timestamptz(6)
  createdAt          DateTime @default(now()) @db.Timestamptz(6)
  @@map("backoffice_terms_acceptances")
}

model BackofficeTermsAcceptanceDocument {
  id                  String  @id @default(uuid()) @db.Uuid
  acceptanceId        String  @db.Uuid
  legalDocumentId     String  @db.Uuid            // FK para a versão exata aceita
  documentType        BackofficeLegalDocumentType
  documentVersion     String  @db.Text
  documentContentHash String  @db.Text            // sha256 do conteúdo exato aceito
  @@unique([acceptanceId, documentType])
  @@map("backoffice_terms_acceptance_documents")
}
```

Um evento de aceite = 1 linha em `backoffice_terms_acceptances` + 3 filhas (uma por documento), atendendo "um registro por assinatura completa, cada documento com versão/hash próprios". `pdfStoragePath/emailSentAt` são os **únicos** campos mutáveis (preenchidos uma vez pelo pipeline pós-aceite) — o trigger de imutabilidade (D9) permite apenas essa transição `NULL → valor`.

### D4 — Hash de conteúdo: SHA-256 de JSON canônico

`sha256(JSON.stringify({ type, version, title, content }))` com `node:crypto` (nunca `Bun.*`), serialização canônica (ordem fixa de chaves, sem whitespace). Calculado no **publish** e gravado em `contentHash`; no aceite, o hash é recalculado do conteúdo servido e comparado — teste unitário garante determinismo.

### D5 — Protocolo gerado no servidor

`CS-<YYYYMMDDHHmmss UTC>-<10 hex de crypto.randomBytes(5)>` (ex.: `CS-20260712143000-A3F09B21CD`). Legível, ordenável, não adivinhável (40 bits aleatórios), unique no banco com retry em colisão. Substitui integralmente `gerarProtocolo` do mockup.

### D6 — PDF server-side com `@react-pdf/renderer` em Service dedicado

- **Lib:** `@react-pdf/renderer` (render em Node/Vercel, sem Chromium, layout declarativo de texto longo com quebra de página automática — adequado às ~20 páginas dos 3 documentos). Não existe skill nem lib de PDF no projeto (audit §2 item 4); esta é a decisão. Alternativa descartada: `pdf-lib` (layout manual de texto corrido inviável), Puppeteer (peso em serverless).
- **Service:** `app/api/services/backofficeTermsAcceptance/TermsAcceptancePdfService.ts` (interface + implementação). Reproduz a estrutura do mockup: barra de capa, "COMPROVANTE DE ACEITE E CONTRATAÇÃO", dados da contratação, cada documento na íntegra precedido de "IDENTIFICAÇÃO DAS PARTES", "DECLARAÇÃO DE ACEITE ELETRÔNICO" com evidências, header/footer com protocolo e paginação.
- **Storage:** bucket **privado** `terms-acceptances` (criado por migration manual), path `acceptances/<acceptanceId>/comprovante-<protocol>.pdf`. Acesso só por signed URL curta gerada no servidor (Backoffice/Account) ou anexo no e-mail. Nunca `getPublicUrl`.
- **Ordem no POST de aceite:** grava o log primeiro (fonte de verdade), depois gera PDF → upload → e-mail. Falha no PDF/e-mail **não** desfaz o aceite; o pipeline é re-executável (rota de retry do Backoffice) graças a `pdfStoragePath/emailSentAt` nulos.

### D7 — Ponto de disparo e gate do fluxo

Em `ensureAccountForPaidAdhesion` (§1.1):

1. Continua criando o usuário Supabase + Profile (nada muda na criação de conta).
2. **Deixa de enviar** o e-mail de set-password imediatamente. Passa a gerar token de aceite (colunas novas na adesão: `acceptanceTokenHash`, `acceptanceTokenPreview`, `acceptanceTokenExpiresAt` — mesmo padrão hash+preview já usado) e envia e-mail "Revise e aceite os documentos" com link `/primeiro-acesso/aceite?token=…`.
3. Ao concluir o aceite (POST), o servidor grava o log e **então** dispara o fluxo existente `sendSetPasswordEmail(adhesion, "invite")` — e a tela de sucesso também oferece o botão "Criar senha" com o mesmo destino, sem depender só do e-mail.
4. **Gate de reforço:** verificação server-side no login/middleware — Profile criado via adesão posterior à feature sem `BackofficeTermsAcceptance` ⇒ redirect para a página de aceite (cobre o caso de invite link antigo/reenviado). Implementado como checagem no fluxo de sessão do produto, cacheada, apenas para perfis com adesão pós-feature (flag na adesão evita custo para a base existente).
5. Reenvio manual: estender o padrão `resendInvite` da adesão com `resendAcceptanceLink` no Backoffice.

### D8 — E-mail transacional

Novo método `EmailService.sendTermsAcceptanceCompletedEmail` em `lib/services/EmailService.ts` (Resend, idempotency key = protocolo, tags de tracking, anexo `Attachment` com o PDF; se o PDF exceder o limite de anexo do Resend, cair para signed URL de 7 dias). Zero contato com `EmailCampaignDispatchService` (marketing). Conteúdo: confirmação do aceite, protocolo, dados da contratação, PDF.

### D9 — Imutabilidade por trigger

Migration manual (`bun run db:migrate:new`): trigger `BEFORE UPDATE OR DELETE` em `backoffice_terms_acceptances` e `backoffice_terms_acceptance_documents` com `RAISE EXCEPTION`, exceto UPDATE que altere **apenas** `pdfStoragePath`/`pdfGeneratedAt`/`emailSentAt` de `NULL` para valor (validado no corpo do trigger). RLS habilitado sem policies de escrita para clientes; toda escrita via service role no backend. Nenhuma rota de update/delete é criada.

### D10 — Página de aceite: pública por token, produto-side

Rota de página `app/primeiro-acesso/aceite/` (produto, como `/set-password`), com API pública sob `app/api/v1/backoffice/adhesions/acceptance/**` (GET por token: dados pré-preenchidos + 3 documentos ativos; POST: aceite). Sem sessão — autenticação é o token de aceite. IP extraído de `x-forwarded-for` no servidor; user-agent do header; o cliente **não** envia IP/UA/timestamp/protocolo.

---

## Estágios

> Regra transversal: todo estágio roda `bun run typecheck 2>&1 | head -20`, `bun run lint`, `bun run governance:check`, `bun run lint:pt-br` (+ `bun run design:check` nos estágios com UI) e inclui testes. Nenhum `db:migrate:push` sem autorização do owner. Migrations de schema via `bun run db:migrate:from-prisma -- <name>`; manuais via `bun run db:migrate:new <name>`.

### Estágio 1 — Schema, migrations e seed dos documentos v1.0

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D1-D5, D9) e agents.md. No lead-flow-app:

1. Adicione ao prisma/schema.prisma: enum BackofficeLegalDocumentType, models
   BackofficeLegalDocument, BackofficeTermsAcceptance, BackofficeTermsAcceptanceDocument
   (estruturas exatas em D2/D3), e as colunas acceptanceTokenHash/acceptanceTokenPreview/
   acceptanceTokenExpiresAt (Text/Text/Timestamptz, opcionais) + termsAcceptanceRequired
   (Boolean @default(false)) em BackofficeAdhesion.
2. Gere a migration de schema: bun run db:migrate:from-prisma -- digital-signature-schema
   (local Supabase na 55322; revisar o SQL gerado).
3. Migration manual (bun run db:migrate:new digital-signature-constraints):
   partial unique index (type) WHERE "isActive" = true em backoffice_legal_documents;
   trigger de imutabilidade de D9 nas duas tabelas de aceite (permitindo somente a
   transição NULL→valor de pdfStoragePath/pdfGeneratedAt/emailSentAt); RLS enabled
   sem policies de escrita; bucket privado terms-acceptances no storage. Tudo idempotente.
4. Migration de dados (bun run db:migrate:new seed-legal-documents-v1): INSERT idempotente
   (ON CONFLICT ("type","version") DO NOTHING) das versões 1.0 ativas dos 3 documentos,
   com conteúdo transcrito do JSON do mockup Primeiro_Acesso.html (arrays "termos",
   "privacidade", "contrato") convertido para os blocos de D2, e contentHash calculado
   pela mesma função canônica de D4 (gerar o SQL a partir de um script TS one-off em
   scripts/, não colar hash manual).
5. Valide replay: bun run db:migrate:reset:local. NÃO aplicar no remoto.
Testes: unit da função de hash canônico (determinismo, sensibilidade a mudança de
conteúdo) em lib ou services correspondente.
Não tocar: rotas existentes, BackofficeAdhesionService, EmailService, telas.
```

**Critérios de aceite:** migrations aplicam do zero no local; 3 documentos ativos no banco com hash preenchido; UPDATE/DELETE manual em `backoffice_terms_acceptances` falha com exception; segunda versão ativa do mesmo type é rejeitada pelo index.
**Validação manual:** `bun run db:migrate:reset:local`; via psql local, tentar `UPDATE backoffice_terms_acceptances SET ip='x'` (deve falhar) e `SELECT type, version, "isActive" FROM backoffice_legal_documents`.

### Estágio 2 — Backend do aceite (rotas públicas + UseCase/Service + protocolo)

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D3-D5, D7, D10), agents.md e o padrão de
BackofficeAdhesionService (token hash/preview) e getPublicDetails. Implemente:

1. app/api/services/backofficeTermsAcceptance/ (I*Service + Service):
   - getAcceptancePageData(token): valida token (hash + expiração), retorna dados
     pré-preenchidos da adesão (email, whatsapp, cpfCnpj quando 14 dígitos → cnpj)
     e os 3 documentos ativos (id, type, version, title, content).
   - submitAcceptance(token, form, ctx { ip, userAgent, locale }): revalida token;
     idempotência por adhesionId (se já existe aceite, retornar o existente com
     mensagem própria, HTTP 200); valida form (CNPJ 14 dígitos, CPF 11, e-mail,
     whatsapp 10-11, cargo em lista, razão social >= 2 chars — mesmas regras do
     mockup, server-side com zod); recalcula o contentHash de cada documento ativo
     e confere com o armazenado; gera protocolo (D5, retry em colisão de unique);
     cria BackofficeTermsAcceptance + 3 documents em transação; invalida o token
     de aceite; retorna protocolo + dados para a tela de sucesso.
2. app/api/useCases/backofficeTermsAcceptance/ retornando Output (lib/output).
3. Rotas: app/api/v1/backoffice/adhesions/acceptance/[token]/route.ts (GET) e
   .../acceptance/[token]/accept/route.ts (POST). HTTP-only: parse, IP de
   x-forwarded-for (primeiro hop), user-agent do header, mapear Output→status.
   Logs [BackofficeTermsAcceptanceRoute][GET|POST].
4. Utilitário do token de aceite no padrão do token de adesão (generate/hash/preview,
   node:crypto), expiração 7 dias, colunas criadas no Estágio 1.
Testes (mesmo padrão BackofficeAdhesionUseCase.test.ts): idempotência (2º POST não
cria 2º log), protocolo único e no formato, hash divergente rejeita, token expirado/
inválido rejeita, validações de form, snapshot dos campos gravados.
Atualize postman/Lead-Flow-API-Collection.json com as 2 rotas.
Não tocar: ensureAccountForPaidAdhesion (integração é o Estágio 5), EmailService,
telas, schema (pronto no Estágio 1).
```

**Critérios de aceite:** GET com token válido traz documentos ativos do banco (nunca hardcoded); POST cria exatamente 1 log com 3 filhas; replay do POST não duplica; testes verdes.
**Validação manual:** com Supabase local, criar adesão de teste + token, chamar GET/POST via Postman e conferir linhas no banco.

### Estágio 3 — PDF server-side + Storage

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D6) e o gerarPDF do mockup Primeiro_Acesso.html
(linhas 819-908) como especificação visual. Implemente:

1. bun add @react-pdf/renderer.
2. app/api/services/backofficeTermsAcceptance/TermsAcceptancePdfService.ts
   (ITermsAcceptancePdfService + impl): gera o Buffer do PDF a partir do log de
   aceite + os 3 documentos (conteúdo das versões exatas aceitas, via FK
   legalDocumentId): capa com dados da contratação e protocolo; por documento,
   página nova com IDENTIFICAÇÃO DAS PARTES (contratante = dados do log;
   contratada = Corretor Studio) e o conteúdo na íntegra respeitando os kinds
   de bloco; DECLARAÇÃO DE ACEITE ELETRÔNICO com evidências (aceito por, empresa,
   data/hora, protocolo, idioma, dispositivo); header/footer em todas as páginas
   com protocolo e "Página X de Y".
3. TermsAcceptanceStorageService (ou método no service principal): upload para o
   bucket privado terms-acceptances no path de D6 e createSignedUrl com TTL curto.
4. Pipeline pós-aceite no service do Estágio 2: após gravar o log, gerar PDF →
   upload → preencher pdfStoragePath/pdfGeneratedAt (única transição permitida
   pelo trigger). Falha não desfaz o aceite; método retryPostAcceptancePipeline
   (acceptanceId) re-executa só as etapas pendentes.
Testes: PDF gerado com protocolo presente e contagem de páginas > 4 (smoke via
parse do buffer), pipeline idempotente (retry não duplica upload), falha de
upload não apaga o log.
Não tocar: rotas públicas (assinaturas de Estágio 2 permanecem), EmailService,
ensureAccountForPaidAdhesion, telas.
```

**Critérios de aceite:** aceite gera PDF fiel à estrutura do mockup e salva no bucket privado; `pdfStoragePath` preenchido; retry funcional; nenhum `getPublicUrl`.
**Validação manual:** aceitar no local, baixar via signed URL e conferir capa/documentos/declaração/protocolo.

### Estágio 4 — E-mail transacional com o comprovante

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D8), lib/services/EmailService.ts (padrão
sendAdhesionCompletedEmail, idempotência, Attachment) e a skill resend.
1. Adicione EmailService.sendTermsAcceptanceCompletedEmail({ userName, userEmail,
   protocol, companyLegalName, cnpj, acceptedAtBR, pdfBuffer|signedUrl }):
   template HTML no padrão dos e-mails transacionais existentes, PDF em anexo
   (fallback: signed URL 7 dias se exceder limite de anexo), idempotencyKey =
   protocolo, tags de tracking no padrão build-resend-tracking-tags.
2. Encaixe no pipeline pós-aceite do Estágio 3 (após upload), preenchendo
   emailSentAt; falha não desfaz aceite/PDF e fica coberta pelo retry.
Testes: mock do Resend — idempotency key correta, anexo presente, emailSentAt só
após sucesso, retry não reenvia quando emailSentAt preenchido.
Não tocar: EmailCampaignDispatchService e qualquer código de campanhas, telas,
ensureAccountForPaidAdhesion.
```

**Critérios de aceite:** e-mail com protocolo + PDF disparado uma única vez por aceite; infra de campanhas intocada.
**Validação manual:** aceite no local com RESEND_API_KEY de teste; conferir recebimento e anexo.

### Estágio 5 — Integração no fluxo de pagamento + gate

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D7) e BackofficeAdhesionService.ts
(ensureAccountForPaidAdhesion, sendSetPasswordEmail, resendInvite, §1.1 do audit).
1. Em ensureAccountForPaidAdhesion: marcar termsAcceptanceRequired=true na adesão,
   gerar token de aceite (colunas do Estágio 1) e trocar o envio imediato de
   sendSetPasswordEmail pelo novo EmailService.sendTermsAcceptanceRequestEmail
   (template novo: "Pagamento confirmado — revise e aceite os documentos",
   link getFullUrl(`/primeiro-acesso/aceite?token=...`)). Manter deferEmailDelivery.
2. No submitAcceptance (Estágio 2): após gravar o log, chamar o fluxo existente
   sendSetPasswordEmail(adhesion, "invite") e retornar também setPasswordUrl para
   o botão "Criar senha" da tela de sucesso.
3. resendAcceptanceLink(id) no service + rota POST
   app/api/v1/backoffice/adhesions/[id]/resend-acceptance (getBackofficeAccess),
   espelhando resendInvite; se o aceite já existe, reencaminha o set-password.
4. Gate de reforço: no fluxo de resolução de acesso do produto (onde o middleware/
   sessão resolve o Profile), para perfis cuja adesão tem termsAcceptanceRequired=true
   e sem BackofficeTermsAcceptance, bloquear o app e redirecionar para a página de
   aceite (buscar token vigente ou regenerar). Não afetar contas existentes
   (flag=false).
Testes: adesão paga não envia set-password antes do aceite; aceite dispara
set-password; reenvio; gate bloqueia/desbloqueia; contas antigas intocadas.
Atualizar Postman (rota de reenvio).
Não tocar: criação de Profile/assinatura na adesão, checkout, demais webhooks.
```

**Critérios de aceite:** ponta a ponta local: pagamento simulado → e-mail de aceite → aceite → e-mail set-password + comprovante → senha → login; usuário sem aceite não entra.
**Validação manual:** simular webhook Asaas no local (Postman) e percorrer o fluxo completo.

### Estágio 6 — Página pública de aceite (frontend)

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D10 + seção Mockups), DESIGN.md, e use as skills
design-system-guard e corretor-studio-design (brief antes do JSX) e o shadcn MCP
(search/view/add) antes de qualquer componente. Implemente
app/primeiro-acesso/aceite/ com features/ completo:
  page.tsx (thin, lê token da query), loading.tsx,
  features/context (Types/Hook/Context), features/services (I*Service + Service
  chamando GET/POST do Estágio 2), features/container (AceiteDocumentosContainer),
  features/components (DocumentTabs, DocumentPane, ConsentRow, ContractDataForm,
  MasterDeclaration, SuccessDialog), features/validation (zod espelhando o server),
  features/utils (máscaras CNPJ/CPF/telefone portadas do mockup em TS puro).
Comportamento (paridade com o mockup): tabs por documento com índice/check;
progresso "N de 3 aceitos"; gate de scroll até o fim libera o checkbox do
documento; hint "Role até o fim"; formulário com pré-preenchimento vindo do GET
e máscaras; declaração final; botão "Aceitar e continuar" só habilita com 3
aceites + form válido + declaração, com lock no primeiro clique (loading,
disabled até finally); mensagens de status de pendência; tela de sucesso
(Dialog) com protocolo, aviso de e-mail enviado, botão de baixar PDF (signed
URL do backend) e "Criar senha" (setPasswordUrl). Timestamp exibido é
informativo; o valor probatório vem do servidor. Documentos renderizados a
partir dos blocos JSON do banco — nenhum texto legal no código. Tokens
semânticos, sem hex, FieldGroup/Field, gap-*, sonner para erros. Token
inválido/expirado: estado de erro com orientação de reenvio.
Rodar também bun run design:check.
Não tocar: backend (Estágios 2-5), set-password, landing pages.
```

**Critérios de aceite:** fluxo completo utilizável no navegador local com paridade funcional ao mockup; `design:check` verde; sem texto legal hardcoded.
**Validação manual:** percorrer no navegador: scroll-gate, 3 aceites, form inválido→válido, aceite, download do PDF, ir para set-password; testar token expirado.

### Estágio 7 — Backoffice: gestão de versões de documentos

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (D2), agents.md (Backoffice Module Isolation) e a
estrutura de app/backoffice/(app)/clients como referência. Implemente:
1. Rotas app/api/v1/backoffice/legal-documents/ (GET lista por type com versões,
   POST cria rascunho, PUT [id] edita rascunho, POST [id]/publish publica —
   calcula contentHash, ativa e desativa a anterior em transação; publicado é
   imutável: PUT em publicado retorna erro). getBackofficeAccess() em todas;
   UseCase com Output.
2. Tela app/backoffice/(app)/legal-documents/ com features/ completo: lista por
   documento (versão ativa, histórico), editor estruturado de blocos (adicionar/
   reordenar/remover meta/heading/subheading/paragraph/listItem/romanItem, com
   preview da renderização), ações Criar nova versão (a partir da ativa),
   Publicar (AlertDialog de confirmação, deixando claro que congela o texto e
   passa a valer para novos aceites, sem alterar aceites passados).
3. Entrada no menu do Backoffice no padrão existente.
Testes: publish troca isActive atomicamente, hash gravado bate com a função
canônica, edição de publicado rejeitada, RBAC (sem getBackofficeAccess → 401/403).
Atualizar Postman. Rodar design:check.
Não tocar: página pública de aceite, log de aceite, fluxo de adesão.
```

**Critérios de aceite:** criar/editar rascunho, publicar v2 e ver a página pública de aceite servindo v2 imediatamente, com aceites antigos apontando para v1.
**Validação manual:** publicar nova versão no Backoffice local e recarregar a página de aceite.

### Estágio 8 — Visibilidade: Backoffice + Account do usuário

**Prompt:**

```text
Leia DIGITAL_SIGNATURE_SPEC.md (goal 6) e BackofficeAllUsersDetailSheet.tsx:193-220
(bloco "Acesso à plataforma") como padrão visual. Implemente:
1. Rota GET app/api/v1/backoffice/terms-acceptances/[profileId] (getBackofficeAccess):
   status do aceite, acceptedAt, protocolo, versões por documento, signed URL do PDF.
   Somente leitura — nenhuma rota de update/delete de log.
2. Estender o bloco "Acesso à plataforma" dos sheets de cliente
   (BackofficeAllUsersDetailSheet e BackofficeMemberProfileSheet) com: Badge de
   aceite (Aceite concluído / Aceite pendente, tokens semantic-success/warning),
   data, protocolo, versão de cada documento e botão "Baixar comprovante"
   (signed URL). Ação "Reenviar link de aceite" quando pendente (rota do Estágio 5).
3. Produto: na tela Account do usuário logado, seção "Documentos aceitos" com os
   mesmos dados do próprio aceite + download do comprovante — rota produto
   GET app/api/v1/account/terms-acceptance usando getTeamAccess()/TeamContext
   (nunca getBackofficeAccess aqui), retornando somente o aceite do próprio
   profileId do contexto.
Testes: RBAC (usuário A não lê aceite do usuário B; rota backoffice exige acesso
backoffice), signed URL com TTL, estados pendente/concluído.
Atualizar Postman. Rodar design:check.
Não tocar: log (imutável), gestão de documentos, página pública.
```

**Critérios de aceite:** Backoffice enxerga aceite de qualquer conta com PDF; usuário baixa apenas o próprio comprovante; nenhum caminho de edição/exclusão do log em nenhuma camada.
**Validação manual:** conferir sheet no Backoffice local e a tela Account com usuário de teste.

### Estágio 9 — Encerramento

Checklist final: PR checklist do `agents.md` completo; `bun run governance:check`, `lint:pt-br`, `design:check` verdes; Postman com todas as rotas novas; push das migrations ao remoto **somente com autorização do owner** (`db:migrate:push:dry-run` antes); follow-up registrado para unificar `app/terms`/`app/privacy-policy` da landing com as versões do banco (CRITIQUE #1).

---

## Mockups (antes → depois)

### Antes (mockup `Primeiro_Acesso.html`)

CSS artesanal (radial-gradient, hex `#FB5C1E`, `#12A150`, sombras custom), fonte via `legal.css`, jsPDF por CDN, JSON de termos embutido, tudo em um HTML.

```text
┌──────────────────────────────────────────────────┐
│ [logo] Corretor Studio · Primeiro acesso          │
│ ┌──────────────────────────────────────────────┐ │
│ │ (eyebrow) ACEITE DIGITAL OBRIGATÓRIO          │ │
│ │ H1 Revise e aceite os documentos…             │ │
│ │ [██████░░░░░░]  0 de 3 aceitos                │ │
│ │ [① Termos] [② Privacidade] [③ Contrato]      │ │
│ │ ┌ pane com scroll (gate no fim) ────────────┐ │ │
│ │ │ …documento… ▼ "Role até o fim…"           │ │ │
│ │ └───────────────────────────────────────────┘ │ │
│ │ [☐] Li e concordo com … · versão              │ │
│ │ ── Confirmação do aceite ──                   │ │
│ │ Dados da empresa (razão social, fantasia,     │ │
│ │ CNPJ) · Dados do representante (nome, CPF,    │ │
│ │ cargo, e-mail, WhatsApp) · data/hora          │ │
│ │ [☐] Declaração final (poderes de repr.)       │ │
│ │ (status)            [Sair] [Aceitar e cont.]  │ │
│ └──────────────────────────────────────────────┘ │
│ Overlay sucesso: ✓ protocolo, e-mail, Baixar PDF,│
│ Entrar na plataforma                             │
└──────────────────────────────────────────────────┘
```

### Depois (produto, design system real)

Mesma anatomia e microinterações, reconstruída com shadcn + tokens do `DESIGN.md` (nenhum hex em JSX; dark mode grátis pelos tokens):

| Elemento do mockup | Implementação no produto |
|---|---|
| Card raiz + fundo gradiente | `Card` sobre `bg-background`; realce com tokens (`bg-primary/…` via classes semânticas), sem gradiente hardcoded |
| Eyebrow "Aceite digital obrigatório" | `Badge` com ícone `ShieldCheck` (lucide) |
| Barra de progresso "N de 3" | `Progress` + label `text-muted-foreground` |
| Tabs ①②③ com check verde | `Tabs`/`TabsList` com indicador de concluído (`Badge`/ícone `Check`, token semantic-success) |
| Pane de leitura com scroll-gate | `ScrollArea` com handler de fim de scroll; hint flutuante `text-muted-foreground` com ícone `ArrowDown` |
| Fim do documento (faixa verde) | `Alert` com token semantic-success |
| Checkbox por documento / declaração final | `Checkbox` + `Label` dentro de `Field`; estado travado com `disabled` + tooltip |
| Formulário (2 colunas, máscaras) | `FieldGroup` + `Field`, `Input` com máscaras portadas, `Select` para cargo — nunca `div` + `space-y-*`; `gap-*` |
| Data/hora "stamp" | `Field` somente leitura com ícone `Clock` (informativo; carimbo real é do servidor) |
| Botão Aceitar (lock) | `Button` com estado `disabled` até validação e lock no clique (spinner), padrão Action Button Request Lock |
| Overlay de sucesso | `Dialog` (com `DialogTitle`; `max-h-[90vh] flex flex-col` se conteúdo crescer) com protocolo, nota de e-mail, `Button` Baixar PDF (signed URL) e Criar senha |
| Erros/avisos | `sonner`; nunca `alert()` |
| Sair → Login.html | Link para `/sign-in` real |

### Backoffice (novos)

- **Gestão de documentos:** lista com 3 cards (um por tipo) mostrando versão ativa + `Badge` de status, tabela de histórico de versões, editor de blocos com preview lado a lado, `AlertDialog` de publicação.
- **Sheet de cliente (extensão):** abaixo do badge "Primeiro acesso", novas linhas no mesmo grid `grid-cols-[140px_1fr]`: "Aceite dos termos" (`Badge` concluído/pendente), "Aceito em", "Protocolo", "Versões" (terms 1.0 · privacy 1.0 · contract 1.0), botão outline "Baixar comprovante".

---

## Não negociáveis (recap de governança aplicada)

- `Route → UseCase → [Service] → Prisma`; Output em todo UseCase novo; `select` > `include`.
- Trigger/RLS/bucket só via migration Supabase CLI; nada de SQL Editor; push remoto só com autorização.
- PDF e protocolo exclusivamente server-side (`node:crypto`, nunca `Bun.*`).
- Log de aceite imutável em todas as camadas (trigger + ausência de rotas de escrita).
- 3 features de UI distintas, cada uma com `features/context|services|container` próprios.
- Testes em todos os estágios; Postman atualizado a cada rota; sem `*_SUMMARY.md`.
