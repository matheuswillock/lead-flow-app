---
title: AWS SES SNS — Passo a passo
date: 2026-08-20
tags:
  - aws
  - ses
  - sns
  - email
  - operacoes
  - corretor-studio
aliases:
  - Liberar SES
  - Conta AWS SES
related:
  - "Migração Self-Hosted — Plano (2026-08)"
status: ready-to-execute
---

# AWS SES / SNS — criar a conta e sair do sandbox

Playbook operacional para **abrir uma conta AWS dedicada** e **liberar Amazon SES + SNS**. Serve ao plano [[Migração Self-Hosted — Plano (2026-08)]] e ao bloqueio atual de envio no Resend.

> [!note] Onde fica no vault
> Vault: `Workspace´s Matheus Willock`
> Pasta: `Corretor studio/Operações/`
> Abrir o canvas `AWS SES SNS — Liberar conta` nesta mesma pasta. Copiar os dois arquivos do repo (`docs/obsidian/Corretor studio/Operações/`) se esta nota ainda não estiver no vault pessoal.

> [!danger] Por que isso existe agora
> Em produção o Resend devolveu `429 monthly_quota_exceeded` (campanhas + `meeting-follow-up`). Não é bug de código — é teto do provedor. SES em **produção** (fora do sandbox) + SNS de bounce/complaint é o caminho para enviar em volume próprio, seja no self-hosted ou conectando a conta ao Resend Scale.

Canvas visual: [[AWS SES SNS — Liberar conta]]

## Decisão de conta

Criar uma **conta AWS nova, só para e-mail**. Não reutilizar conta pessoal, de cliente ou de experimento.

| Item | Valor sugerido |
|------|----------------|
| Nome da conta | `corretor-studio-ses` |
| E-mail root | um alias novo (`aws-ses@corretorstudio.com.br` ou `matheus+aws-ses@…`) |
| Região principal | **São Paulo (`sa-east-1`)** |
| Região extra | `us-east-1` só se for manter o domínio `perttoconsultoria.com.br` |
| Plano de suporte | **Basic** (grátis) |

Domínios já verificados no Resend (auditoria 2026-08-10):

| Domínio | Região Resend | Status |
|---------|---------------|--------|
| `corretorstudio.com` | `sa-east-1` | verified |
| `corretorstudio.com.br` | `sa-east-1` | verified |
| `perttoconsultoria.com.br` | `us-east-1` | verified |
| `mail.libercorretora.com.br` | `sa-east-1` | tracking falho |
| `backstageclub.com.br` | `sa-east-1` | tracking falho |

> [!warning] Sandbox é por região
> Sair do sandbox em `sa-east-1` **não** libera `us-east-1`. Se precisar das duas, peça production access nas duas.

## Checklist rápido

- [ ] E-mail root exclusivo criado
- [ ] Conta AWS criada + cartão + telefone
- [ ] MFA no usuário root
- [ ] Usuário IAM admin (parar de usar root)
- [ ] Budget/alarme de custo
- [ ] Console na região `sa-east-1`
- [ ] Identidade SES do domínio `corretorstudio.com.br` (acelera o pedido)
- [ ] Tópicos SNS Standard de bounce e complaint
- [ ] Pedido de production access enviado
- [ ] AWS Support aprovou (24h–alguns dias)
- [ ] Teste no mailbox simulator
- [ ] Account ID + ARNs anotados no cofre (não no chat)

---

## 1. Pré-requisitos

Levar na mão **antes** de abrir o signup:

1. E-mail que você controla e que **não** é o login do dia a dia.
2. Celular para SMS da AWS.
3. Cartão de crédito (a AWS valida; SES barato não isenta o cadastro).
4. CPF ou CNPJ da empresa.
5. App de MFA (1Password, Authy, Google Authenticator).
6. URL pública do produto: `https://www.corretorstudio.com`.

Não ligue EC2, Lightsail, RDS nem nada além de SES/SNS/IAM/Budgets nesta conta.

## 2. Criar a conta AWS

1. Abra [https://portal.aws.amazon.com/billing/signup](https://portal.aws.amazon.com/billing/signup).
2. Escolha **Sign up for AWS (advanced)** — controle total da conta, sem “project” pré-configurado.
3. Preencha:
   - **Root user e-mail:** o alias novo
   - **AWS account name:** `corretor-studio-ses`
4. Confirme o e-mail.
5. Crie a senha do root (guarde no cofre).
6. Contato: telefone brasileiro; aceite o SMS/chamada.
7. Pagamento: cartão. A AWS pode autorizar um valor simbólico e estornar.
8. Support plan: **Basic**.

No canto superior direito, anote o **Account ID** de 12 dígitos. É o que o Resend / o plano self-hosted vai pedir.

Docs: [What is an AWS account](https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-creating.html)

## 3. Endurecer o root (10 minutos, não pule)

Ainda logado como root:

1. **MFA no root** — IAM → Dashboard → Add MFA. App TOTP, dois dispositivos se possível.
2. **Não crie access keys no root.**
3. **IAM → Users → Create user** `matheus.admin`
   - Console access
   - Grupo com `AdministratorAccess` (só nesta conta vazia)
   - MFA obrigatório nesse usuário também
4. Saia do root. Daqui pra frente, só o IAM user.
5. **Billing → Budgets** — alarme em USD 20 e USD 50 para o e-mail do Matheus.
6. Canto superior direito → região **São Paulo (sa-east-1)**.

## 4. Ligar o SES na região certa

1. Console: [https://console.aws.amazon.com/ses/](https://console.aws.amazon.com/ses/) com a região **sa-east-1**.
2. Account dashboard — deve aparecer o aviso *Your Amazon SES account is in the sandbox*.
3. **Identities → Create identity → Domain**
   - Domain: `corretorstudio.com.br` (ou o subdomínio de envio, se o plano self-hosted já tiver escolhido um, ex. `send.corretorstudio.com.br`)
   - Assign default DKIM (Easy DKIM / RSA 2048)
4. Publique os CNAME de DKIM no DNS. **Não** ligue proxy laranja no Cloudflare.
5. (Opcional mas ajuda o pedido) MAIL FROM / custom return path no mesmo domínio.

> [!tip] Pedido mais rápido
> A AWS aprova production access **mais rápido** quando já existe **domínio verificado**. Faça o DNS antes de clicar em Request production access.

Identidades de teste: um e-mail seu (`matheus@corretorstudio.com.br`) também pode ser verificado para enviar no sandbox enquanto espera.

## 5. SNS — bounce e complaint (obrigatório no pedido)

O checkbox do pedido de produção exige processo de bounce/complaint. Monte **antes** de submeter.

> [!warning] Tipo do tópico
> SES **não aceita FIFO**. Crie tópicos **Standard**.

Na **mesma região** do SES (`sa-east-1`):

1. SNS → Topics → Create topic
   - `ses-bounces-sa-east-1` (Standard)
   - `ses-complaints-sa-east-1` (Standard)
2. Em cada tópico → Edit → Access policy, acrescente permissão para o SES publicar (troque ACCOUNT, região e nomes):

```json
{
  "Version": "2012-10-17",
  "Id": "notification-policy",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ses.amazonaws.com" },
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:sa-east-1:ACCOUNT_ID:ses-bounces-sa-east-1",
      "Condition": {
        "StringEquals": {
          "AWS:SourceAccount": "ACCOUNT_ID",
          "AWS:SourceArn": "arn:aws:ses:sa-east-1:ACCOUNT_ID:identity/corretorstudio.com.br"
        }
      }
    }
  ]
}
```

3. Subscribe um endpoint que você controla (e-mail temporário ou HTTPS depois). **Confirme a inscrição** no e-mail da AWS — sem isso o tópico fica mudo.
4. SES → Identities → `corretorstudio.com.br` → **Notifications** → Feedback notifications:
   - Bounce → `ses-bounces-sa-east-1`
   - Complaint → `ses-complaints-sa-east-1`
5. Depois que SNS estiver recebendo, desligue **Email Feedback Forwarding** nessa identity para não duplicar aviso.

Não use chave KMS customer-managed no tópico nesta fase (exige policy extra em KMS e é a causa nº 1 de `InvalidParameterValue`).

Docs: [Configuring Amazon SNS notifications for Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/configure-sns-notifications.html)

## 6. Pedir production access (sair do sandbox)

Sandbox nesta região = só destinatários verificados, **200 e-mails/24h**, **1/s**. Inútil para o Corretor Studio.

1. SES → Account dashboard → **View Get set up page** → **Request production access**.
2. Preencha assim (ajustável se o plano self-hosted já tiver decisão de mix):

| Campo | Valor |
|-------|--------|
| Mail type | **Marketing** se a maioria do volume for campanha; **Transactional** se quiser aprovação mais conservadora (convites/onboarding). Volume real hoje é campanha. |
| Website URL | `https://www.corretorstudio.com` |
| Additional contacts | `matheus@corretorstudio.com.br` |
| Preferred language | English |
| Acknowledgement | marcado — só quem pediu o e-mail; bounce/complaint via SNS |

Texto para colar no caso de uso / ticket de Support (se a AWS pedir mais detalhes):

```
The Corretor Studio (https://www.corretorstudio.com) is a Brazilian SaaS for health-insurance brokers.

We send:
- transactional mail (meeting invites, member onboarding, password/account notices);
- permission-based campaigns to leads/clients who opted in inside the product.

Recipients are customers or consented leads, not purchased cold lists. The app already implements unsubscribe, suppression on bounce/complaint, and per-team sending limits.

We currently send through a managed provider (Resend) and have hit monthly quota (HTTP 429 monthly_quota_exceeded), which also blocked meeting reminders. We are moving sending to Amazon SES in sa-east-1 (São Paulo) on a dedicated AWS account. Bounce and complaint notifications are wired to Amazon SNS Standard topics.

We will keep bounce rate under 5% (target <2%) and complaint rate under 0.1%.
```

3. Submit. **Não edite os detalhes até a review terminar.**
4. Resposta inicial em até **24h**. Se pedirem mais info, responda no **AWS Support Center** (não por e-mail solto).

Docs: [Request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)

> [!faq] Marketing ou Transactional?
> A AWS pede **um** rádio. Campanhas são a maior parte do volume (`EMAIL_AUDIT` §8.2). Escolher Marketing é o mais honesto. Se o pedido for recusado com “descreva opt-in”, responda com o fluxo de consentimento do produto (Radar channel consent + unsubscribe) e reabra o caso.

## 7. Depois da aprovação

1. Account dashboard **não** deve mais mostrar sandbox.
2. Teste no [mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html#send-email-simulator):
   - `success@simulator.amazonses.com`
   - `bounce@simulator.amazonses.com` → tópico de bounce
   - `complaint@simulator.amazonses.com` → tópico de complaint
3. Guarde no cofre (não no Obsidian aberto, não no chat):
   - Account ID
   - ARN dos tópicos SNS
   - ARN da identity SES
4. **Caminho Resend:** abrir o painel / ticket Scale e conectar esta conta (eles assumem um role; não compartilhe a senha do root).
5. **Caminho self-hosted (plano 2026-08):** IAM user/role só com `ses:SendEmail` / `ses:SendRawEmail` na identity verificada; HTTPS subscription do SNS apontando para o webhook da app (equivalente ao `app/api/webhooks/resend`).

## Armadilhas

| Armadilha | Efeito | Como evitar |
|-----------|--------|-------------|
| Conta antiga / compartilhada | Pedido recusado ou reputação suja | Conta nova, vazia, só SES/SNS |
| Região errada no console | “já pedi” em `us-east-1` e o envio é `sa-east-1` | Conferir o seletor **toda** sessão |
| Tópico SNS FIFO | SES recusa | Standard |
| Tópico em outra região | `InvalidParameterValue` | SNS = mesma região do SES |
| KMS customer-managed no SNS | SES não publica | Deixe encryption default nesta fase |
| Cloudflare proxy no DKIM | Identity nunca verifica | DNS cinza / DNS only |
| Mandar lista fria no dia 1 | Suspensão da conta | Só consentimento; warm-up |
| Access key no root | Risco de sequestro | Só IAM user + MFA |
| Pedir produção sem SNS | Checkbox mentiroso; recusa ou suspensão depois | SNS antes do Submit |

## O que **não** fazer nesta conta

- Subir VPS, Kubernetes, banco, S3 de produto.
- Verificar dezenas de domínios de cliente no dia 1 — comece pelos da plataforma (`corretorstudio.com.br` / `corretorstudio.com`).
- Ligar dedicated IP antes de volume estável (warm-up de semanas).
- Commitar chaves IAM no `lead-flow-app`.

## Referências

- [[Migração Self-Hosted — Plano (2026-08)]]
- `EMAIL_AUDIT.md` §8.2 e §9 (cota Resend + domínios)
- `docs/RESEND_DOMAIN_SETUP.md`
- [SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [SNS feedback](https://docs.aws.amazon.com/ses/latest/dg/configure-sns-notifications.html)
- [Signup AWS](https://portal.aws.amazon.com/billing/signup)
- [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
