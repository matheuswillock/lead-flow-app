# SPEC — Aceite eletrônico de documentos

**Status:** implementado nesta entrega  
**Escopo:** aceite eletrônico para novas adesões pagas  
**Fora de escopo:** assinatura qualificada ICP-Brasil; consultar `ICP_BRASIL_SIGNATURE_SPEC.md`

## Objetivo

Entre a confirmação do pagamento e a criação da senha, o representante da empresa deve ler e aceitar Termos de Uso, Política de Privacidade e Contrato. O sistema preserva as versões exibidas, registra evidências no servidor, gera comprovante PDF e impede acesso ao produto enquanto o aceite obrigatório estiver pendente.

## Regras de negócio

1. Os três documentos são independentes e versionados.
2. Um `BackofficeLegalDocumentSet` publicado referencia exatamente uma versão de cada documento; somente um conjunto pode estar ativo.
3. Documentos e conjuntos publicados são imutáveis. Uma alteração exige nova versão.
4. Cada adesão possui no máximo um aceite e cada aceite contém três snapshots documentais.
5. Adesões anteriores à ativação da funcionalidade permanecem com `termsAcceptanceRequired=false`.
6. Uma adesão paga nova cria a conta Supabase/Profile, mas envia primeiro o link de aceite. A recuperação de senha é enviada somente depois do aceite.
7. O primeiro acesso é persistido em `firstPlatformAccessAt` quando o master acessa com sucesso uma API protegida do produto.

## Segurança do token

- Token: 32 bytes aleatórios, codificados em Base64 URL-safe.
- Persistência: somente SHA-256, preview não sensível, emissão, expiração de sete dias e contador de tentativas.
- Transporte: o token chega uma vez na URL e é trocado por cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção; a navegação continua em URL limpa.
- Respostas: `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex, nofollow`.
- Consumo: expiração gravada na transação do aceite; o hash é preservado somente para resolver concorrência/idempotência.
- Replay: devolve protocolo e data, nunca um link de senha.
- Limite: dez tentativas de validação por token; um novo envio invalida o token anterior.

## Registro probatório

`BackofficeTermsAcceptance` registra adesão, Profile, conjunto, protocolo, instante do servidor, IP disponível, user-agent, locale e snapshot dos dados declarados. Cada `BackofficeTermsAcceptanceDocument` preserva tipo, título, versão, schema, conteúdo, publicação e hash SHA-256.

O hash de documento usa JSON canônico de `{ type, version, title, schemaVersion, content }`. O banco impede UPDATE/DELETE das evidências e impede alteração/exclusão de artefatos publicados. Somente os campos inicialmente nulos do processamento de PDF/e-mail podem ser preenchidos uma vez.

## Fluxo HTTP

- `GET /api/v1/backoffice/adhesions/acceptance/exchange?token=…`: troca token por cookie e redireciona.
- `GET /api/v1/backoffice/adhesions/acceptance`: retorna adesão, conjunto e documentos a partir do cookie.
- `POST /api/v1/backoffice/adhesions/acceptance`: valida formulário, declaração e binding dos três IDs/hashes exibidos.
- `GET /api/v1/backoffice/adhesions/acceptance/cron`: processa outbox com `CRON_SECRET`.
- `GET /api/v1/backoffice/terms-acceptances/:profileId/download`: gera URL privada de cinco minutos para o backoffice.
- `POST /api/v1/backoffice/terms-acceptances/:profileId/retry`: reagenda tarefas esgotadas sem apagar o histórico de tentativas.
- `GET /api/v1/account/terms-acceptance/download`: gera URL privada somente para o aceite do usuário autenticado.

Se o conjunto ativo mudar entre GET e POST, o servidor responde `409`; a interface descarta as confirmações e exige nova leitura. Concorrência é protegida por transação serializável e unicidade por adesão.

## Evidência assíncrona

A transação cria três tarefas idempotentes:

1. `generate_evidence`: renderiza PDF no servidor com `@react-pdf/renderer`, calcula SHA-256 e grava no bucket privado `terms-acceptances`.
2. `send_confirmation_email`: envia protocolo e PDF anexo depois da geração.
3. `send_password_recovery`: gera link Supabase do tipo `recovery`, nunca `invite` para usuário existente.

O worker usa claim condicional, lock recuperável, até oito tentativas e backoff exponencial. Falha de PDF/e-mail não desfaz o aceite.

## Gate de acesso

`getAccountAccessStatus` retorna `termsAcceptanceGranted`. `getTeamAccess` responde `403` para contas cuja adesão paga exige aceite e não possui registro. Proxy/cliente não são considerados fronteiras de autorização. O cache de acesso é invalidado após o aceite.

## Pipeline do cliente no backoffice

O sheet do cliente exibe uma lista vertical derivada exclusivamente dos eventos:

1. Nova adesão — `createdAt`
2. Pago — `paidAt`
3. Aceite — `acceptedAt`
4. Primeiro acesso — `firstPlatformAccessAt`

Cada passo é `completed`, `current`, `pending` ou `blocked`. Adesões `overdue`, `expired` e `canceled` bloqueiam os passos restantes. O backoffice pode reenviar o link de aceite e baixar o comprovante quando disponível. Membros sem adesão não recebem pipeline artificial.

## Operação e privacidade

- Bucket privado, URL assinada curta e nenhuma exposição por `getPublicUrl`.
- Credenciais Supabase/Resend somente no servidor.
- IP, CPF/CNPJ e dados de representação são acessíveis apenas a funções autorizadas e usados para execução contratual/evidência.
- A política de retenção e descarte deve ser aprovada pelo jurídico antes do rollout em produção.
- A migration cria as tabelas com RLS deny-by-default; o backend Prisma é a única camada de escrita.
- Nenhum texto jurídico é inventado por seed. Antes de ativar o fluxo, o negócio deve inserir, revisar e publicar um conjunto completo.

## Critérios de aceite

- Token inválido, expirado, consumido ou após dez tentativas não cria aceite.
- Duas submissões concorrentes resultam em um único registro.
- O aceite preserva exatamente os três documentos exibidos.
- Replay não duplica outbox, e-mail ou recuperação de senha.
- Usuário pendente recebe `403` em APIs protegidas; usuário aceito é liberado imediatamente.
- PDF, hash, protocolo e snapshots permanecem imutáveis.
- Falhas do worker podem ser retomadas sem duplicação.
- Pipeline e ações refletem os quatro eventos reais.

## Rollout

1. Aplicar migration e criar o bucket privado.
2. Inserir e publicar os três documentos e o primeiro conjunto após revisão jurídica.
3. Confirmar `CRON_SECRET`, Supabase Admin e Resend em produção.
4. Percorrer uma adesão interna ponta a ponta.
5. Só então habilitar a criação de novos tokens de aceite em produção.
