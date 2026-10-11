# Guia para aplicar os templates no sistema

## Como o envio funciona hoje

Os arquivos `.html` desta pasta são **referência visual**. O sistema não lê esses arquivos:
o HTML de cada e-mail transacional está escrito dentro de `lib/services/EmailService.ts`
(e afins), e as variáveis são preenchidas ali mesmo com `${data.x}`.

Os templates foram refeitos no formato e-mail-safe (tabelas, CSS inline, logo PNG
hospedada, sem SVG, flex, grid ou Google Fonts), que abre corretamente no Gmail, Outlook e
Apple Mail. Para o cliente receber o visual novo, o HTML de cada método precisa ser
substituído pelo do template correspondente.

## Como aplicar um template

1. Abra o template e localize o método indicado em `Fonte:` no comentário do topo.
2. Copie o HTML (de `<!DOCTYPE html>` até `</html>`) para o template literal do método,
   sem o comentário de documentação.
3. Troque cada `{{{nomeDaVariavel}}}` pelo valor correspondente (`${data.nomeDaVariavel}`),
   mantendo o escape que o método já aplica hoje.
4. Blocos marcados com comentário de "opcional" (`leadPhone`, `addonDetail`, `notes`,
   solicitante do add-on, `featureImageUrl`) devem ser renderizados só quando houver valor.
5. Nos 5 métodos da seção "Trechos montados pelo sistema", troque também o HTML desses
   pedaços pelo trecho indicado.

## Situação de cada template

**Já têm método de envio (trocar o HTML):** `welcome`, `subscription-confirmation`,
`adhesion-completed`, `lead-notification-new`, `lead-proposal-pending-urgent`,
`operator-invite`, `pending-account-user-payment`, `password-reset`,
`operator-access-removed`, `meeting-invite`, `closer-schedule-notification`,
`account-deletion-farewell`, `addon-pending-payment`, `addon-confirmed`,
`backoffice-adhesion-checkout`, `backoffice-lead-schedule-invite-closer`,
`backoffice-lead-schedule-invite-participants`, `performance-export`,
`master-invoice-status-notification`.

**Sem método de envio encontrado (fluxo novo, a decidir):** `subscription-renewal-30-days`,
`subscription-renewal-15-days`, `subscription-renewal-7-days`,
`subscription-renewed-confirmation`, `access-expired-partial-restriction`,
`access-suspended-data-deletion`, `team-added-charge`, `team-added-free`,
`user-added-free`, `lead-follow-up`.

**Marketing e relacionamento (disparo por campanha no Resend):** `receba-leads-pme`,
`dia-do-corretor-12-outubro`, `abordagem-comercial-1`, `abordagem-comercial-2`,
`abordagem-comercial-followup`, `convite-lancamento`, `card-live-recorrente`,
`confirme-sua-presenca-live-09jul`, `convite-live-09jul-segunda-chance`, `promo-campaign`,
`winback`, `product-announcement`, `welcome-associado`, `cliente-sem-acesso-ativacao`,
`periodo-gratuito-encerrado`, `no-show-reagendar`, `onboarding-day-1/3/7`. Esses usam
variáveis em chaves triplas `{{{nome}}}` (padrão do Resend). Os 12 de marketing têm o link
"Cancelar inscrição" com a variável obrigatória `{{{link_descadastro}}}`.

`support-request.html` não foi alterado.

## Trechos montados pelo sistema

Alguns métodos montam um pedaço de HTML à parte e encaixam no e-mail. Hoje esses pedaços
saem com estilo antigo (outras cores, fonte maior, emojis). O Gmail e o Outlook ignoram o
`<style>` do template que antes "repintava" esses pedaços, então eles precisam sair do
código já com o estilo inline abaixo. Só muda a aparência: lógica e condições continuam
iguais. Nos trechos, `{{...}}` são os valores que o próprio método já preenche.

### 1. `roleCapabilitiesHtml` · `operator-invite.html`

**Operador**
```html
<p style="margin:0 0 8px; font-family:Arial, Helvetica, sans-serif; font-size:11px; font-weight:bold; letter-spacing:0.9px; text-transform:uppercase; color:#1C1B22;">Como Operador, você poderá:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:6px 0; border-bottom:1px solid #ECECF0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.55; color:#3D3C44;">Gerenciar seus próprios leads</td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid #ECECF0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.55; color:#3D3C44;">Acompanhar o funil de vendas</td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid #ECECF0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.55; color:#3D3C44;">Visualizar métricas e estatísticas</td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid #ECECF0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.55; color:#3D3C44;">Atualizar status de leads</td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid #ECECF0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.55; color:#3D3C44;">Adicionar anotações e acompanhamentos</td></tr>
  <tr><td style="padding:6px 0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.55; color:#3D3C44;">Fazer upload de documentos</td></tr>
</table>
```

**Gerente**: mesmo HTML, trocando o título para `Como Gerente, você poderá:` e os itens para:
Gerenciar todos os leads da equipe · Adicionar e gerenciar operadores e managers ·
Acompanhar métricas da equipe · Distribuir leads entre operadores · Visualizar dashboards
completos · Controlar assinaturas e pagamentos. A última linha fica sem `border-bottom`.

---

### 2. `leadCrmMarkup` · `closer-schedule-notification.html`

Sem o rótulo "Lead no Corretor Studio:" (o template já tem o rótulo "Lead no CRM").
```html
<a href="{{leadCrmUrl}}" style="font-family:Arial, Helvetica, sans-serif; font-size:14px; font-weight:bold; color:#ff6900; text-decoration:none;">Abrir lead no CRM</a>
```

---

### 3. `attendeesMarkup` · `closer-schedule-notification.html`

**Com participantes** (uma linha por e-mail):
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:4px 0; font-family:'Courier New',monospace; font-size:12.5px; color:#3D3C44; word-break:break-all;">{{attendeeEmail}}</td></tr>
</table>
```

**Sem participantes**:
```html
<p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-style:italic; color:#9A99A6;">Nenhum participante informado.</p>
```

---

### 4. `linkMarkup` · `meeting-invite.html` e `closer-schedule-notification.html`

**Com link**:
```html
<a href="{{meetingLink}}" style="font-family:Arial, Helvetica, sans-serif; font-size:14px; font-weight:bold; color:#ff6900; text-decoration:none; word-break:break-all;">{{meetingLink}}</a>
```

**Sem link**:
```html
<span style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#9A99A6;">Link não informado</span>
```

---

### 5. `paymentInstructionsHtml` · `pending-account-user-payment.html`

**PIX**
```html
<p style="margin:0 0 10px; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.6; color:#3D3C44;">Copie o código PIX abaixo para concluir a cobrança adicional:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid #E5E4EA; border-radius:10px; padding:14px; font-family:'Courier New',monospace; font-size:12.5px; color:#1C1B22; word-break:break-all;">{{pixPayload}}</td></tr></table>
```

**Boleto**
```html
<p style="margin:0 0 10px; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.6; color:#3D3C44;">A cobrança foi gerada em boleto. Use o link abaixo para visualizar e pagar:</p>
<p style="margin:0 0 12px;"><a href="{{boletoUrl}}" style="display:inline-block; background-color:#E07400; color:#ffffff; text-decoration:none; padding:11px 22px; border-radius:999px; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; font-weight:bold;">Abrir boleto</a></p>
<p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#6E6D7A;">Vencimento: {{boletoDueDate}}</p>
```

**Cartão / outro**
```html
<p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:13.5px; line-height:1.6; color:#3D3C44;">A cobrança incremental foi enviada ao {{billingTypeLabel}}. Assim que o pagamento for confirmado, o novo usuário será criado automaticamente.</p>
```

> Nos trechos acima, `{{...}}` são os valores que o próprio backend já preenche ao montar o
> pedaço (não são variáveis do template).

---

## Outras observações

- `welcome.html` usa `loginUrl`.
- Preview de todos os templates lado a lado: abra `templates/index.html` no navegador.
