# PRICING_MODEL.md — Precificação do Corretor Studio por slug

**Data:** 2026-07-19
**Fontes:** tabelas `BackofficeProduct`/`BackofficeProductPaymentRule` (fonte de verdade operacional), `prisma/seed-backoffice-products.ts` e migrations (reprodução versionada ainda incompleta), `lib/features/feature-slugs.ts` (slugs de feature), `RADAR_AUDIT.md` e `RADAR_SPEC.md` (spec e auditoria do Radar rastreadas no repositório — a proposta comercial de pivot está condensada em `PRICING_TABLE.md` §4 deste repositório).
**Escopo:** consolida (1) toda a precificação vigente por `featureSlug` de produto, (2) o mapa completo de features → produto que as cobra, e (3) a regra de cálculo correta do valor de uma assinatura a partir dos slugs contratados.

---

## 1. Modelo de dados — como o preço se liga ao slug

A precificação vive em três entidades do backoffice:

| Entidade | Chave | Papel |
|---|---|---|
| `BackofficeProduct` | `featureSlug` (+ `isDefault`) | Linha de preço vendável. Guarda `type` (PLAN/ADDON), `billingMode` (RECURRING/LIFETIME) e os preços base por cadência (`priceMonthly`, `priceQuarterly`, `priceSemiannual`, `priceAnnual`, `priceLifetime`). |
| `BackofficeProductPaymentRule` | `productId` + `paymentMethod` + `billingCycle` | Preço efetivo por forma de pagamento (PIX vs cartão) e cadência, com regra de parcelamento (`canInstallment`, `maxInstallments`). **Quando existe, prevalece sobre o preço base do produto.** |
| `BackofficeFeature` | `slug` (+ `productSlug`, `parentId`) | Feature visível no produto. `productSlug` aponta para o `BackofficeProduct.featureSlug` que a cobra. Filhas com `inheritParentSettings: true` herdam acesso do pai; `inheritParentSettings: false` + `parentSlug` ⇒ `billedSeparately: true`. |

> Nota de auditoria: o schema atual de `BackofficeProductType` ainda comporta `PLAN` e `ADDON`. A tabela comercial já usa `FEE` para itens como `radar-setup`; isso deve ser tratado na SPEC como evolução de modelagem ou como item de cobrança única sem entitlement recorrente.

**Regra de resolução de preço de um item (ordem):**

1. Buscar `BackofficeProductPaymentRule` para (produto, método de pagamento, cadência). Se existir, esse é o preço/mês.
2. Senão, usar o campo de preço base do produto para a cadência (`priceQuarterly` etc.).
3. `billingMode = LIFETIME` ⇒ usar `priceLifetime` (pagamento único).

**Regra de resolução de acesso (o que o cliente enxerga):** `hasAccess(slug)` exige que a feature exista em `backoffice_features` com `isActive`, que o principal tenha regra de acesso ≠ NONE, e que o produto apontado por `productSlug` esteja ativo na assinatura do cliente. Feature sem linha no banco = invisível para todos (por isso todo `featureSlug` novo exige migration de seed + atualização do `seed-backoffice-products.ts`).

**Vocabulário obrigatório para a SPEC:**

- **Produto vendável**: `BackofficeProduct.featureSlug` — é o slug que tem preço, ciclo, método de pagamento e aparece como item cobrado.
- **Feature navegável**: `BackofficeFeature.slug` — é o slug que libera menu, rota ou capacidade de uso no produto.
- **Entitlement de assinatura**: conjunto derivado de assinatura ativa + produtos contratados + capacidades pagas. Deve expor `productSlugs`, `featureSlugs`, add-ons e capacidades de forma única para backend e frontend.
- **Fee/taxa única**: item cobrado uma vez, como `radar-setup`; entra na fatura, mas não libera feature sozinho.

---

## 2. Catálogo de produtos vigente (por `featureSlug`)

### 2.1 Preços base (`BackofficeProduct`, variante `isDefault`)

| featureSlug | Nome | Tipo | Cobrança | Mensal | Trimestral | Semestral | Anual | Vitalício |
|---|---|---|---|---|---|---|---|---|
| `crm` | CRM | PLAN | Recorrente | R$89,90 | R$79,90 | R$69,90 | R$69,90 | — |
| `crm-lifetime` | CRM Vitalício | PLAN | Única (lifetime) | — | — | — | — | **null** ⚠️ |
| `extra-team` | Time Adicional | ADDON | Recorrente | R$29,90 | R$29,90 | R$29,90 | R$29,90 | — |
| `extra-user` | Usuário Adicional | ADDON | Recorrente | R$19,90 | R$19,90 | R$19,90 | R$19,90 | — |
| `email` | Email | ADDON | Recorrente | R$29,90 | R$29,90 | R$29,90 | R$29,90 | — |
| `whatsapp` | WhatsApp | ADDON | Recorrente | R$39,90 | R$34,90 | R$29,90 | R$29,90 | — |
| `cdp` | CDP | ADDON | Recorrente | R$29,90 | R$29,90 | R$29,90 | R$29,90 | — |

⚠️ `crm-lifetime` está com todos os preços `null` no seed — o valor real do vitalício é definido manualmente no backoffice (variante não-default). O mesmo vale para a variante **Associados (R$2.400 / termo fechado 12 meses)**: existe como variante cadastrada no backoffice, não no seed. Ver §6.

### 2.2 Regras de pagamento (PIX vs Cartão) — prevalecem sobre o §2.1

**CRM (`crm`):**

| Método | Mensal | Trimestral | Semestral | Anual | Parcelamento (cartão) |
|---|---|---|---|---|---|
| PIX | R$89,90 | R$79,90 | R$69,90 | R$69,90 | — |
| Cartão | R$102,90 | R$91,40 | R$79,90 | R$79,90 | 1× / 3× / 6× / 12× |

**WhatsApp (`whatsapp`):**

| Método | Mensal | Trimestral | Semestral | Anual | Parcelamento (cartão) |
|---|---|---|---|---|---|
| PIX | R$39,90 | R$34,90 | R$29,90 | R$29,90 | — |
| Cartão | R$45,90 | R$39,90 | R$34,90 | R$34,90 | 1× / 3× / 6× / 12× |

**CDP (`cdp`):**

| Método | Mensal | Trimestral | Semestral | Anual | Parcelamento (cartão) |
|---|---|---|---|---|---|
| PIX | R$29,90 | R$29,90 | R$29,90 | R$29,90 | — |
| Cartão | R$29,90 | R$29,90 | R$29,90 | R$29,90 | 1× / 3× / 6× / 12× |

`extra-team`, `extra-user` e `email` **não têm payment rules** — usam o preço base do §2.1 em qualquer método de pagamento (sem acréscimo de cartão). Ver §6 sobre a inconsistência disso.

---

## 3. Mapa feature → produto (quem cobra o quê)

Todos os slugs de `FEATURE_SLUGS` (`lib/features/feature-slugs.ts`) e o produto que os libera:

### 3.1 Guarda-chuva CRM (produto `crm`)

| Feature slug | Nome | Cobrada por | Herda do pai | Observação |
|---|---|---|---|---|
| `crm` | CRM | `crm` | — (raiz) | |
| `crm-dashboard` | Dashboard | `crm` | Sim | |
| `crm-lead-transfers` | Transferências | `crm` | **Não** (`billedSeparately`) | Acesso restrito a MASTER/MANAGER/BACKOFFICE |
| `crm-calendar` | Calendário | `crm` | Sim | |
| `crm-performance` | Performance | `crm` | Sim | OPERATOR sem acesso |
| `crm-simulator` | Simulador de Planos | `crm` | Sim | |
| `crm-time` | Time | `crm` | Sim | |
| `crm-time-manage-teams` | Gerenciar Times | **`extra-team`** | Sim | Feature filha do CRM, mas paga pelo add-on Time Adicional |
| `crm-time-manage-users` | Gerenciar Usuários | **`extra-user`** | Sim | Idem, paga pelo add-on Usuário Adicional |
| `crm-wallet` | Carteira | `crm` | Sim | Só MASTER/MANAGER/BACKOFFICE |
| `crm-automations` | Automações | `crm` | Sim | Só MASTER/MANAGER/BACKOFFICE |
| `studio-bot` | Bethânia | `crm` | — (raiz) | Sem preço próprio — vem com o CRM |
| `studio-bot-ops` | Ops / Host | `crm` | Não | Só MASTER/BACKOFFICE |

### 3.2 Guarda-chuva Email (produto `email`)

`email` (raiz, beta), `email-templates`, `email-contacts`, `email-campaigns`, `email-history`, `email-analytics`, `email-unsubscribe`, `email-settings` (não herda — `billedSeparately`). Acesso: MASTER e MANAGER apenas, em todas.

### 3.3 Guarda-chuva WhatsApp (produto `whatsapp`)

`whatsapp` (raiz, beta — acesso todos os papéis), `whatsapp-auto-responses` (não herda — só MASTER/MANAGER), `whatsapp-settings` (herda — só MASTER/MANAGER).

### 3.4 Sem produto pago

| Feature slug | Situação |
|---|---|
| `cdp` | Produto próprio `cdp` (R$29,90) — **será substituído pelas linhas Radar do §5** |
| `integration` | `accessMode: PUBLIC`, `productSlug: null` — não é cobrada |

### 3.5 Regras explícitas de pai, filho e add-on

1. **Slug pai libera filhos herdados:** uma assinatura do produto do pai libera os filhos com `inheritParentSettings: true`, desde que as regras por principal permitam o papel do usuário.
2. **Filho cobrado separadamente não herda preço:** quando um filho aponta para `productSlug` próprio ou funciona como add-on, o acesso exige esse produto ativo; o pai serve só como organização da navegação.
3. **Add-on multiplicável exige capacidade:** `extra-team`, `extra-user` e `radar-dispatch-pack` não devem liberar capacidade operacional só por existir um produto no catálogo. O entitlement correto exige produto ativo + quantidade/capacidade paga maior que zero.
4. **Add-on booleano exige produto ativo:** `whatsapp`, tiers `email-dispatch-*` e tiers `radar-*` liberam seus slugs quando o produto recorrente correspondente está ativo.
5. **Taxa única não é acesso:** `radar-setup` compõe a cobrança do primeiro ciclo, mas não deve aparecer como `featureSlug` liberado nem permitir acesso sem um tier Radar recorrente.
6. **Email embutido no CRM é mudança de catálogo:** enquanto `email` estiver cadastrado como add-on ativo, o gate continua exigindo produto `email`; a migração alvo deve mover features `email-*` para `productSlug: "crm"` e desativar a cobrança separada.

---

## 4. Cálculo correto de uma assinatura

**Fórmula do valor mensal recorrente:**

```
total recorrente/mês = preço(plano base, método, cadência)
                     + Σ preço(add-on booleano ativo, método, cadência)
                     + Σ (quantidade de add-on multiplicável × preço(add-on, método, cadência))

primeira fatura = total recorrente do ciclo
                + Σ taxas únicas do contrato
```

> ⚠️ **Add-ons multiplicáveis são tratados separadamente** e **não entram** no `Σ add-ons booleanos`; contá-los nos dois lugares geraria cobrança duplicada.

Regras que o cálculo DEVE respeitar:

1. **Payment rule primeiro** — se existir `BackofficeProductPaymentRule` para (produto, método, cadência), ela é o preço. Só cair no preço base do produto na ausência de regra.
2. **Cadência é da assinatura, não do item** — todos os itens seguem a mesma cadência contratada (trimestral, semestral…). Não misturar cadências entre plano e add-ons.
3. **Add-ons multiplicáveis** — no catálogo vigente, `extra-team` e `extra-user` multiplicam por quantidade; no estado-alvo da tabela completa, `radar-dispatch-pack` também multiplica. Todos os demais add-ons recorrentes são 0 ou 1 (presentes ou ausentes).
4. **Cobrança única não entra na recorrência** — `crm-lifetime` e fees como `radar-setup` são cobranças únicas, somadas apenas à fatura correspondente.
5. **Feature ≠ preço** — features nunca têm preço próprio; o preço vem sempre do `BackofficeProduct` apontado por `productSlug`. `crm-time-manage-teams`/`crm-time-manage-users` são o exemplo canônico: vivem sob o CRM na navegação, mas cobram pelos add-ons.
6. **Entitlement ≠ item cobrado bruto** — a assinatura deve expor tanto os itens cobrados quanto os slugs liberados derivados deles. Um fee como `radar-setup` aparece nos itens cobrados, mas não nos slugs liberados.
7. **Capacidade governa uso de add-ons multiplicáveis** — o produto `extra-user` pago com quantidade 3 deve liberar capacidade para 3 usuários extras, não apenas um booleano "tem extra-user".

### Exemplos (PIX)

| Cenário | Composição | Cálculo | Total/mês |
|---|---|---|---|
| Corretor solo, mensal | `crm` | 89,90 | **R$89,90** |
| Corretor + email, semestral | `crm` + `email` | 69,90 + 29,90 | **R$99,80** |
| Corretora, 2 times, 3 operadores extras, anual | `crm` + `whatsapp` + `email` + 1×`extra-team` + 3×`extra-user` | 69,90 + 29,90 + 29,90 + 29,90 + 3×19,90 | **R$219,30** |
| Mesmo cenário no cartão | idem | 79,90 + 34,90 + 29,90 + 29,90 + 3×19,90 | **R$234,30** |

---

## 5. Radar — linhas propostas (estado-alvo para SPEC, NÃO cadastradas)

O Radar substitui o produto `cdp`. Contratação mínima de 3 meses (sem mensal avulso), sempre com CRM ativo (bundle obrigatório, CRM cobrado à parte no preço cheio — decisão em aberto). Nesta auditoria, a tabela inteira entra como contexto-alvo para a SPEC, mas nada abaixo deve ser lido como implementação já aplicada no seed, no banco ou no `FeatureAccessService`.

| featureSlug proposto | Nome | Tipo | Cobrança | Trimestral | Semestral | Anual |
|---|---|---|---|---|---|---|
| `radar-starter` | Radar — 500 e-mails/dia | ADDON | Recorrente | R$350 *(calculado)* | R$325 | R$300 |
| `radar-plus` | Radar — 1.000 e-mails/dia | ADDON | Recorrente | R$590 *(calculado)* | R$549 | R$505 |
| `radar-pro` | Radar — 2.000 e-mails/dia | ADDON | Recorrente | **R$990 *(confirmado)*** | R$921 | R$851 |
| `radar-setup` | Radar — Configuração inicial | FEE | Única (1º mês) | R$1.200 (qualquer tier/prazo) | — | — |

Margem bruta vs custo Resend conservador (R$102,20/mês cobre qualquer tier sozinho): Starter 71%, Plus 83%, Pro 90%.

**Cálculo com Radar (exemplo, tier Pro, trimestral, PIX):**

```
1º mês:  crm 79,90 + radar-pro 990,00 + radar-setup 1.200,00 = R$2.269,90
demais:  crm 79,90 + radar-pro 990,00                        = R$1.069,90
```

**Checklist para cadastrar o Radar quando os valores forem validados:**

1. Adicionar slugs em `lib/features/feature-slugs.ts` (`RADAR`, subfeatures de segmento/disparo/relatórios se aplicável).
2. `bun run db:migrate:new seed-radar-products` — inserir produtos + features + access rules (idempotente).
3. Atualizar `prisma/seed-backoffice-products.ts` (`PRODUCTS`, `FEATURES`, `ACCESS_RULES_BY_SLUG`, payment rules Radar).
4. Desativar o produto/feature `cdp` (marcar `isActive: false`, não deletar — há FKs de assinaturas).
5. Payment rules Radar: definir se cartão tem acréscimo como no CRM/WhatsApp ou preço único como no CDP (decisão em aberto).

---

## 6. Inconsistências e lacunas encontradas

1. **`crm-lifetime` sem preço no seed** — todos os campos `null`; o valor real só existe como variante manual no backoffice. Qualquer reset de ambiente local perde esse preço. Recomendação: fixar `priceLifetime` no seed.
2. **Variante Associados (R$2.400 / 12 meses) fora do seed** — mesmo problema: cadastrada só via backoffice, sem rastro em migration/seed. Ambientes locais e CI não a reproduzem.
3. **Acréscimo de cartão inconsistente** — CRM (+14,5%) e WhatsApp (+15%) cobram mais no cartão; CDP, `email`, `extra-team` e `extra-user` não. Se a regra de negócio é "cartão custa mais", `email`/`extra-*` precisam de payment rules; se não é, o CDP ter payment rules idênticas ao preço base é ruído.
4. **`email` a R$29,90 vs tiers do Radar** — quando o Radar entrar, o add-on `email` a R$29,90 com disparo incluso canibaliza os tiers (R$350+). Definir se `email` vira só transacional/templates (sem massa) ou se é absorvido pelo Radar.
5. **`studio-bot` cobra pelo `crm` mas é ADDON no accessMode** — funciona, mas significa que Bethânia não tem preço próprio; se um dia for monetizada, precisa de produto dedicado.
6. **CDP anunciado como substituído, mas ainda ativo** — a linha `cdp` (R$29,90) segue `isActive: true` no seed enquanto o `RADAR_BUSINESS_MODEL.md` a declara extinta. Até o rename/pivot ser aplicado, há risco de venda dupla do mesmo domínio por preços muito diferentes.
