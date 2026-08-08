npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
═══════════════════════════════════════════════════
🔍 ANÁLISE: Leads Perdidos (form.started órfãos)
═══════════════════════════════════════════════════

📋 Buscando times...

✅ 2 times encontrados:
   • Avalanche de Vendas Unipessoal Ltda (aef1bfe7...) - meu@universo.top
   • MultiSkill (7b577c22...) - bruno@onsidemarketing.com.br

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analisando: Avalanche de Vendas Unipessoal Ltda

   🔍 0 eventos form.started de email encontrados
   🔍 0 sem lead associado

   ✅ Nenhum lead perdido detectado!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Analisando: MultiSkill

   🔍 17 eventos form.started de email encontrados
   🔍 9 sem lead associado

   📋 Validando eventos...

   ✅ 9 eventos validados


═══════════════════════════════════════════════════
📊 RELATÓRIO: Leads Perdidos
═══════════════════════════════════════════════════

## Resumo Executivo

- **Período analisado:** 2026-07-08 até hoje
- **Times analisados:** 2
- **Total de eventos órfãos:** 9

### Distribuição por Time

- **MultiSkill:** 9 eventos órfãos

### Distribuição por Razão

- **validation_gate_failure:** 9 eventos

### Leads Recuperáveis

- **Total:** 9 leads podem ser recuperados
- **Critério:** form.started com emailLogId válido + nome + (email OU telefone)

### Sample de Leads Recuperáveis (primeiros 20)

| Time | Nome | Email | Telefone | Data | Campanha |

|------|------|-------|----------|------|----------|

| MultiSkill | Jorge | originallimp@originallimp.com.br | N/A | 2026-08-07 | Rede D'Or . 001 |
| MultiSkill | Antonio | acforgati@hotmail.com | N/A | 2026-08-07 | Rede Dor 02 |
| MultiSkill | Valdeni | valdenicsilva@eixotecnicometalurgia.com | N/A | 2026-08-06 | Rede D'Or . 001 |
| MultiSkill | Roberto | diretoria@verticemedical.com.br | N/A | 2026-08-06 | Rede D'Or . 001 |
| MultiSkill | Barbara | ape503contato@outlook.com | N/A | 2026-08-06 | Rede Dor Mulheres |
| MultiSkill | Fabio | atendimento@newfleetautocenter.com.br | N/A | 2026-08-06 | Rede D'Or . 001 |
| MultiSkill | Nelson | contato@hypercar.com.br | N/A | 2026-08-06 | Rede D'Or . 001 |
| MultiSkill | Nelson | contato@hypercar.com.br | N/A | 2026-08-06 | Rede D'Or . 001 |
| MultiSkill | Edivaldo | internacionalguarulhos@palmeirasstore.com.br | N/A | 2026-08-06 | Rede D'Or . 001 |

## Recomendações

✅ **9 leads podem ser recuperados**

Execute o script de backfill:

```bash
npx tsx scripts/backfill-lost-leads.ts --dry-run
npx tsx scripts/backfill-lost-leads.ts --apply
```


═══════════════════════════════════════════════════
✅ Análise completa!
═══════════════════════════════════════════════════
