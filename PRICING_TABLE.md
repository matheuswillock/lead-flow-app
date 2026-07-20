# PRICING_TABLE.md — Tabela oficial de precificação do Corretor Studio

**Data:** 2026-07-19 (rev. 2 — inclui E-mail Disparo avulso, excedentes e tabela consolidada)
**Complementa:** `PRICING_MODEL.md` (regra de cálculo e modelo de dados) e `RADAR_BUSINESS_MODEL.md` (racional comercial do Radar).
**Legenda de status dos valores:**

| Marca | Significado |
|---|---|
| ✅ | Vigente — cadastrado no seed/backoffice hoje |
| 💡 | **Sugerido** — lacuna sem valor definido; proposta desta tabela, precisa de aprovação |
| 📋 | Proposto no `RADAR_BUSINESS_MODEL.md` — aguardando validação |

Valores **por mês** salvo indicação de cobrança única. PIX é o preço de referência; cartão carrega acréscimo de ~15% (padrão CRM/WhatsApp). Piso de margem: **nenhum item pode operar abaixo de 60% de margem bruta em nenhuma cadência**.

---

## 1. Planos base

### 1.1 CRM (`crm`) — PLAN, recorrente ✅

| Método | Mensal | Trimestral | Semestral | Anual | Parcelamento |
|---|---|---|---|---|---|
| PIX | R$89,90 | R$79,90 | R$69,90 | R$69,90 | — |
| Cartão | R$102,90 | R$91,40 | R$79,90 | R$79,90 | até 3×/6×/12× conforme cadência |

> **Proposta pendente de implementação** — esta decisão não está ativa ainda. O add-on `email` (R$29,90) segue sendo cobrado enquanto o seed, a migration e o `FeatureAccessService` não forem atualizados (pendência §7, item 5). Este parágrafo descreve o estado-alvo após a migração técnica.

### 1.2 CRM Vitalício (`crm-lifetime`) — PLAN, pagamento único 💡

Sugestão ancorada em 3× o contrato anual PIX (payback 36 meses):

| Método | Valor único | Parcelamento |
|---|---|---|
| PIX | **R$2.490,00** 💡 | — |
| Cartão | **R$2.790,00** 💡 | até 12× de R$232,50 |

### 1.3 CRM Associados (variante Associados) ✅ *(fora do seed — ver §7)*

| Termo | Valor | Equivalência |
|---|---|---|
| 12 meses fechado (termo único) | **R$2.400,00** | R$200,00/mês |

---

## 2. Add-ons recorrentes

### 2.1 Time Adicional (`extra-team`) — por time extra

| Método | Mensal | Trimestral | Semestral | Anual |
|---|---|---|---|---|
| PIX | R$29,90 ✅ | R$29,90 ✅ | R$29,90 ✅ | R$29,90 ✅ |
| Cartão | **R$34,90** 💡 | **R$34,90** 💡 | **R$32,90** 💡 | **R$32,90** 💡 |

### 2.2 Usuário Adicional (`extra-user`) — por operador extra

| Método | Mensal | Trimestral | Semestral | Anual |
|---|---|---|---|---|
| PIX | R$19,90 ✅ | R$19,90 ✅ | R$19,90 ✅ | R$19,90 ✅ |
| Cartão | **R$22,90** 💡 | **R$22,90** 💡 | **R$21,90** 💡 | **R$21,90** 💡 |

### 2.3 WhatsApp (`whatsapp`) ✅

| Método | Mensal | Trimestral | Semestral | Anual | Parcelamento |
|---|---|---|---|---|---|
| PIX | R$39,90 | R$34,90 | R$29,90 | R$29,90 | — |
| Cartão | R$45,90 | R$39,90 | R$34,90 | R$34,90 | até 3×/6×/12× |

### 2.4 Email (`email`) — **descontinuado como add-on cobrado**

O módulo de templates/e-mail transacional passa a vir **embutido na mensalidade do CRM** (§1.1), sem cobrança separada. As features `email-*` migram para `productSlug: "crm"` quando o cadastro for atualizado. Disparo em massa vira produto próprio: **E-mail Disparo** (§3).

### 2.5 CDP (`cdp`) ✅ — **descontinuar com a chegada do Radar**

R$29,90 (PIX e cartão, todas as cadências). Ação pendente: `isActive: false` quando as linhas Radar forem cadastradas (não deletar — FKs de assinaturas ativas).

---

## 3. E-mail Disparo avulso (`email-dispatch-*`) 💡 — NOVO

Disparo de e-mail em massa **sem** a segmentação/enriquecimento do Radar. Produto de entrada: **sem setup, sem prazo mínimo** (mensal, cancela quando quiser). Cota expressa **por mês**. Quem contrata Radar não precisa deste produto — o Radar já inclui disparo em volume muito maior (§4).

### 3.1 Mensalidade por tier

| featureSlug | Cota/mês | Mensal (PIX) | Semestral (-7%) | Anual (-14%) | Cartão mensal (+15%) | Margem (pior caso) |
|---|---|---|---|---|---|---|
| `email-dispatch-starter` | 500 | **R$99** 💡 | R$92 | R$85 | R$115 | 88% (anual) |
| `email-dispatch-plus` | 1.000 | **R$149** 💡 | R$139 | R$129 | R$172 | 92% (anual) |
| `email-dispatch-pro` | 2.000 | **R$249** 💡 | R$232 | R$215 | R$287 | 95% (anual) |

Base de custo: cotas cabem no Resend Pro rateado (custo marginal ≈ R$10,22/tier em rateio conservador de 10 contas) — todas as cadências ficam bem acima do piso de 60%.

### 3.2 Excedente — cobrança por unidade acima da cota mensal

Ancorado em ~1,25× o preço unitário embutido na cota (torna o upgrade de tier sempre mais barato que pagar excedente cronicamente):

| Tier | R$/e-mail na cota | Excedente unitário 💡 | Exemplo: +200 e-mails |
|---|---|---|---|
| Starter | R$0,198 | **R$0,25** | R$50,00 |
| Plus | R$0,149 | **R$0,20** | R$40,00 |
| Pro | R$0,125 | **R$0,15** | R$30,00 |

---

## 4. Radar (substitui o CDP) 📋

Regras: mínimo 3 meses (sem mensal avulso); sempre exige CRM ativo (cobrado à parte, preço cheio); **inclui disparo de e-mail em volume diário** (não precisa contratar E-mail Disparo à parte); **setup único de R$1.200 no 1º mês, igual para todos os tiers**, somado à mensalidade.

### 4.1 Mensalidade por tier — PIX 📋

| featureSlug | Tier | E-mails/dia | E-mails/mês (~22 d.u.) | Trimestral | Semestral (-7%) | Anual (-14%) |
|---|---|---|---|---|---|---|
| `radar-starter` | Starter | 500 | 11.000 | R$350 *(calculado)* | R$325 | R$300 |
| `radar-plus` | Plus | 1.000 | 22.000 | R$590 *(calculado)* | R$549 | R$505 |
| `radar-pro` | Pro | 2.000 | 44.000 | **R$990 (confirmado)** | R$921 | R$851 |

### 4.2 Mensalidade por tier — Cartão 💡 (PIX +15%, arredondado)

| featureSlug | Trimestral | Semestral | Anual | Parcelamento |
|---|---|---|---|---|
| `radar-starter` | **R$399** 💡 | **R$375** 💡 | **R$345** 💡 | até 3×/6×/12× |
| `radar-plus` | **R$679** 💡 | **R$629** 💡 | **R$579** 💡 | até 3×/6×/12× |
| `radar-pro` | **R$1.139** 💡 | **R$1.059** 💡 | **R$979** 💡 | até 3×/6×/12× |

### 4.3 Setup (`radar-setup`) — cobrança única no 1º mês, todo tier

| Método | Valor | Parcelamento |
|---|---|---|
| PIX | **R$1.200** 📋 | — |
| Cartão | **R$1.380** 💡 (+15%) | até 3× de R$460 |

**Modelo oficial do 1º mês: setup SOMA à mensalidade** (ex.: Radar Pro trimestral, mês 1 = 1.200 + 990 = R$2.190).

### 4.4 Cota adicional de disparo (`radar-dispatch-pack`) 💡 — NOVO

O cliente Radar pode comprar mais cota de disparo **sem alterar a quantidade de leads fornecida** (a base segmentada/enriquecida não muda — só o volume de envio):

| Item | Volume | Preço/mês | R$/e-mail |
|---|---|---|---|
| `radar-dispatch-pack` | +5.000 e-mails/mês por pacote (multiplicável) | **R$149** 💡 | R$0,0298 (~1,3× o unitário do Radar Pro) |
| Excedente avulso (sem pacote) | por e-mail acima da cota | **R$0,05/e-mail** 💡 | — |

Margem ≥ 90% (custo marginal Resend acima de 50k/mês ≈ R$0,005/e-mail no plano Scale).

### 4.5 Total do contrato mínimo (3 meses, PIX)

| Tier | Setup + 3 mensalidades | Total |
|---|---|---|
| Starter | 1.200 + 3×350 | **R$2.250** |
| Plus | 1.200 + 3×590 | **R$2.970** |
| Pro | 1.200 + 3×990 | **R$4.170** |

---

## 5. Simulações de fatura (PIX)

| Cenário | Itens | Cálculo | Total/mês |
|---|---|---|---|
| Corretor solo (mensal) | `crm` | 89,90 | **R$89,90** |
| Solo + disparo básico (mensal) | `crm` + `email-dispatch-starter` | 89,90 + 99 | **R$188,90** |
| Corretora (anual) | `crm` + `whatsapp` + 1×`extra-team` + 3×`extra-user` | 69,90 + 29,90 + 29,90 + 59,70 | **R$189,40** |
| Radar Pro (trimestral), 1º mês | `crm` + `radar-pro` + `radar-setup` | 79,90 + 990 + 1.200 | **R$2.269,90** |
| Radar Pro (trimestral), demais meses | `crm` + `radar-pro` | 79,90 + 990 | **R$1.069,90** |
| Radar Pro + 2 pacotes extras (trimestral) | `crm` + `radar-pro` + 2×`radar-dispatch-pack` | 79,90 + 990 + 298 | **R$1.367,90** |
| Disparo Plus estourou +300 e-mails no mês | `email-dispatch-plus` + excedente | 149 + 300×0,20 | **R$209,00** |

---

## 6. TABELA CONSOLIDADA — todos os produtos, com Total do contrato

Preços PIX. **Total = setup + mensalidade × meses do prazo** (cobrança única = valor único; excedentes/packs fora, pois variam por uso).

| Slug | Produto | Prazo | Setup | Mensalidade | **Total do contrato** |
|---|---|---|---|---|---|
| `crm` | CRM | Mensal | — | R$89,90 | **R$89,90/mês** |
| `crm` | CRM | Trimestral | — | R$79,90 | **R$239,70** |
| `crm` | CRM | Semestral | — | R$69,90 | **R$419,40** |
| `crm` | CRM | Anual | — | R$69,90 | **R$838,80** |
| `crm-lifetime` 💡 | CRM Vitalício | Único | — | — | **R$2.490,00** |
| `crm` (Associados) | CRM Associados | 12 meses fechado | — | R$200,00 equiv. | **R$2.400,00** |
| `extra-team` | Time Adicional | Mensal (por time) | — | R$29,90 | **R$29,90/mês** · anual R$358,80 |
| `extra-user` | Usuário Adicional | Mensal (por usuário) | — | R$19,90 | **R$19,90/mês** · anual R$238,80 |
| `whatsapp` | WhatsApp | Mensal | — | R$39,90 | **R$39,90/mês** |
| `whatsapp` | WhatsApp | Trimestral | — | R$34,90 | **R$104,70** |
| `whatsapp` | WhatsApp | Semestral | — | R$29,90 | **R$179,40** |
| `whatsapp` | WhatsApp | Anual | — | R$29,90 | **R$358,80** |
| `email` | Email (templates/transacional) | — | — | **Incluído no CRM** | **R$0** |
| `email-dispatch-starter` 💡 | E-mail Disparo 500/mês | Mensal | — | R$99 | **R$99/mês** |
| `email-dispatch-starter` 💡 | E-mail Disparo 500/mês | Semestral | — | R$92 | **R$552** |
| `email-dispatch-starter` 💡 | E-mail Disparo 500/mês | Anual | — | R$85 | **R$1.020** |
| `email-dispatch-plus` 💡 | E-mail Disparo 1.000/mês | Mensal | — | R$149 | **R$149/mês** |
| `email-dispatch-plus` 💡 | E-mail Disparo 1.000/mês | Semestral | — | R$139 | **R$834** |
| `email-dispatch-plus` 💡 | E-mail Disparo 1.000/mês | Anual | — | R$129 | **R$1.548** |
| `email-dispatch-pro` 💡 | E-mail Disparo 2.000/mês | Mensal | — | R$249 | **R$249/mês** |
| `email-dispatch-pro` 💡 | E-mail Disparo 2.000/mês | Semestral | — | R$232 | **R$1.392** |
| `email-dispatch-pro` 💡 | E-mail Disparo 2.000/mês | Anual | — | R$215 | **R$2.580** |
| `radar-starter` 📋 | Radar 500/dia | Trimestral | R$1.200 | R$350 | **R$2.250** |
| `radar-starter` 📋 | Radar 500/dia | Semestral | R$1.200 | R$325 | **R$3.150** |
| `radar-starter` 📋 | Radar 500/dia | Anual | R$1.200 | R$300 | **R$4.800** |
| `radar-plus` 📋 | Radar 1.000/dia | Trimestral | R$1.200 | R$590 | **R$2.970** |
| `radar-plus` 📋 | Radar 1.000/dia | Semestral | R$1.200 | R$549 | **R$4.494** |
| `radar-plus` 📋 | Radar 1.000/dia | Anual | R$1.200 | R$505 | **R$7.260** |
| `radar-pro` 📋 | Radar 2.000/dia | Trimestral | R$1.200 | R$990 | **R$4.170** |
| `radar-pro` 📋 | Radar 2.000/dia | Semestral | R$1.200 | R$921 | **R$6.726** |
| `radar-pro` 📋 | Radar 2.000/dia | Anual | R$1.200 | R$851 | **R$11.412** |
| `radar-dispatch-pack` 💡 | Cota extra Radar +5.000/mês | Mensal (multiplicável) | — | R$149 | **R$149/mês por pacote** |
| `radar-setup` 📋 | Setup Radar (todo tier) | Único (1º mês) | — | — | **R$1.200,00** |
| `cdp` | CDP *(descontinuar)* | Mensal | — | R$29,90 | **R$29,90/mês** |

Excedentes (por uso, fora do Total): Disparo Starter R$0,25 · Plus R$0,20 · Pro R$0,15 por e-mail; Radar sem pacote R$0,05 por e-mail.

---

## 7. Pendências para efetivar esta tabela

| # | Ação | Onde |
|---|---|---|
| 1 | Aprovar os valores 💡 (lifetime, cartão de `extra-*`, tiers/excedentes do E-mail Disparo, cartão do Radar, setup no cartão, `radar-dispatch-pack`) | Decisão do owner |
| 2 | Validar tiers Radar Starter/Plus (R$350/R$590 são extrapolados) | Decisão do owner |
| 3 | Fixar `crm-lifetime` e variante Associados no seed (hoje só existem no backoffice manual) | `prisma/seed-backoffice-products.ts` + migration |
| 4 | Criar payment rules de cartão para `extra-team` e `extra-user` **e** atualizar `BackofficeAdhesionService.resolvePrices` + `calculateBackofficeAdhesionPricing` para carregar e aplicar essas regras — sem isso, os preços de cartão novos não chegam às faturas | seed + migration + `BackofficeAdhesionService` |
| 5 | Descontinuar `email` como add-on cobrado: features `email-*` migram para `productSlug: "crm"` no seed/migration; atualizar `FeatureAccessService` para não exigir mais o produto `email` separado | seed + migration + `FeatureAccessService` |
| 6 | Cadastrar slugs `email-dispatch-*` (produto + feature + access rules + excedente) | `lib/features/feature-slugs.ts` + `bun run db:migrate:new` + seed |
| 7 | Cadastrar produtos/features Radar (`radar-*`, `radar-setup`, `radar-dispatch-pack`) e desativar `cdp`; **incluir** o tier recorrente, setup único e dispatch-pack em `calculateBackofficeAdhesionPricing` e na ativação de adesão para que o Asaas gere as cobranças corretas | `feature-slugs.ts` + migration + seed + `BackofficeAdhesionService` + Asaas billing |
| 8 | Definir mecânica de medição/cobrança do excedente (fatura do mês seguinte via Asaas) | Spec técnica futura |
