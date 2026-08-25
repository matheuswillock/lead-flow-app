# Runbook — cron `database-backup`

Encaminhamento do achado T-Q5.3 da SPEC 50 (CDP 2026-08). **Não é problema de
funil CDP — é continuidade de negócio**, e por isso vive fora daquela SPEC.

## Estado medido em 2026-08-24

`backoffice_cron_executions` para `cronKey = 'database-backup'` (schedule
`0 8 * * *`, `maxDuration = 300`):

| Status | Execuções | Última |
|---|---|---|
| `success` | 4 | 2026-08-17 08:00 UTC |
| `failed` | 7 | 2026-08-24 08:01 UTC |
| `running` (órfã) | 4 | 2026-08-21 08:01 UTC |

**O último backup bem-sucedido é de 17/08.** Toda execução desde 18/08 falhou
ou travou.

O `errorSummary` do cron é sempre `Erro ao gerar backup` — mensagem genérica
que o `BackofficeDatabaseBackupUseCase` grava ao engolir a causa
(`runBackupJob`, bloco `catch`). A causa real está em
`backoffice_database_backups.errorMessage`:

```sql
select status, left(coalesce("errorMessage",''), 300) as erro, count(*), max("startedAt")
from public.backoffice_database_backups
group by 1, 2
order by 3 desc;
```

## Três falhas distintas, em ordem cronológica

**1. Timeout de transação (13–16/08, 4 execuções).**

```
Transaction API error: Transaction already closed: A query cannot be executed
on an expired transaction. The timeout for this transaction was 280000 ms,
however 280183 ms passed since the start of the transaction.
```

O export roda dentro de uma transação interativa do Prisma com timeout de
280 s e o volume passou a estourá-lo. Tabelas que aparecem no erro:
`radarIdentity`, `emailContact`, `radarSourceLink` — as três maiores.

**2. Kill de plataforma (18–21/08, 4 execuções).**

`errorMessage = "Backup abandonado por timeout — liberado automaticamente para
novos disparos"`. São exatamente as 4 linhas `running` órfãs em
`backoffice_cron_executions`: a função foi morta no teto de 300 s, o `catch`
do `withCronAudit` nunca rodou. Com o watchdog de execuções órfãs (E1 da
SPEC 50) essas passam a ser marcadas `failed` e a alertar no Slack.

**3. Limite de string do V8 (22–24/08, 3 execuções).**

`errorMessage = "Invalid string length"`. O export monta o dump como uma única
string JSON e ela ultrapassou o tamanho máximo de string do V8. Note a
duração: 75–90 s, bem antes do timeout de transação — o processo agora morre
mais cedo, montando a string, e nem chega perto de terminar.

## Encaminhamento

A falha 3 é a que bloqueia hoje e não se resolve aumentando timeout nem
`maxDuration`: nenhum limite de tempo faz caber uma string maior que o
máximo do V8. O export precisa deixar de materializar o dump inteiro em
memória — streaming por tabela / NDJSON em chunks, escrevendo direto no ZIP.

**Correção em PR #1047** (branch `bugfix/database-backup-invalid-string-length`).
Enquanto ela não for mergeada e um ciclo rodar verde, **assuma que não existe
backup automático desde 17/08** e faça o dump manualmente.

O PR resolve comprovadamente as falhas 1 e 3. **A falha 2 (kill de plataforma
no teto de 300s) não está provada resolvida**: a prova de volume exercita
serializar → zipar → subir, não a leitura do Postgres real de 3.213 MB dentro
do orçamento da função. A paginação continua por `skip`, que é O(n²) — a
recomendação em aberto é keyset.

## Formato do artefato (a partir de 2026-08-25)

ZIP com uma entrada `<Model>.ndjson` por modelo — um objeto JSON por linha,
não mais um array JSON único por tabela. Modelos sem linhas viram entrada vazia.

Inspecionar sem descompactar tudo:

```bash
unzip -l backup-AAAA-MM-DD-HH-mm.zip
unzip -p backup-AAAA-MM-DD-HH-mm.zip Lead.ndjson | head -1 | jq .
unzip -p backup-AAAA-MM-DD-HH-mm.zip Lead.ndjson | wc -l
```

## Garantia de consistência (leia antes de restaurar)

O backup **não** é um ponto-no-tempo do banco. Cada tabela é lida na própria
transação `RepeatableRead`: as páginas de uma mesma tabela são consistentes
entre si, mas tabelas diferentes vêm de snapshots diferentes.

Na prática: registros criados durante a janela do backup podem aparecer com
referência pendente. Qualquer carga precisa tolerar FK adiada ou desabilitada.

Para snapshot consistente de verdade, use `pg_dump` — não este job.

## Não existe importador

Nenhum código do repositório lê este ZIP (`JSZip.loadAsync` não aparece em
lugar nenhum; a UI baixa o arquivo como blob opaco e nunca o parseia).
Restaurar hoje é trabalho manual: descompactar, ler o NDJSON e montar os
inserts. **O único caminho de restauração real do projeto é o `pg_dump`.**
Considere isso ao decidir se este artefato satisfaz o RPO/RTO pretendido.

## Diagnóstico quando falhar

A causa real agora chega ao `errorSummary` do cron e ao Slack, no formato
`Erro ao gerar backup: <causa>`. Antes era sempre o genérico — foi o que
deixou o incidente de 13–24/08 uma semana sem diagnóstico.

| Sintoma no `errorSummary` | Leitura |
|---|---|
| `Invalid string length` | Regressão: alguma string voltou a crescer com o número de linhas. Não é timeout. |
| `Transaction already closed` / `timeout ... ms passed` | Uma tabela isolada não coube em `MODEL_TRANSACTION_TIMEOUT_MS` (120s). Verifique o crescimento dela e avalie `EXCLUDED_MODELS`. |
| Execução `running` órfã, sem `errorSummary` | Kill de plataforma no teto de 300s: o `catch` não chegou a rodar. Indica leitura total acima do orçamento da função. |

**Nota para quem for escrever teste de regressão:** `bun test` roda em
JavaScriptCore (teto de string 2³¹−1 = 2.147.483.647 chars) e a produção roda
em Node/V8 (teto 536.870.888). O runner é 4× mais permissivo e **não
reproduz** `Invalid string length` — por isso os testes existentes passavam com
o bug em produção. Asserte por volume medido, nunca por exceção.

## Dump manual (procedimento)

O `.env` do repositório **não pode ser lido com `source`**: a linha do
`DATABASE_URL` tem `?pgbouncer=true&connection_limit=1&...` e o `&` sem aspas
quebra o parser do shell. O source aborta ali, `DIRECT_URL` fica vazia e o
`pg_dump` cai silenciosamente no socket local — o erro que aparece é
"conexão com o servidor no soquete /var/run/postgresql", que não tem nada a
ver com a causa. Extraia só a variável:

```bash
export DIRECT_URL="$(sed -n 's/^DIRECT_URL=//p' /caminho/lead-flow-app/.env | head -1)"
STAMP=$(date +%Y%m%d-%H%M)
pg_dump "$DIRECT_URL" -Fc --no-owner --no-acl -v \
  -f /mnt/Armazenamento/Backup/leadflow-$STAMP.dump \
  2> /mnt/Armazenamento/Backup/leadflow-$STAMP.log
```

Use `DIRECT_URL` (session pooler, porta 5432), nunca `DATABASE_URL` — o
transaction pooler da 6543 não suporta `pg_dump`. O cliente `pg_dump`
**precisa ser ≥ 17**, a versão do servidor.

Conferir integridade, não só existência:

```bash
pg_restore -l /mnt/Armazenamento/Backup/leadflow-<stamp>.dump | grep -c 'TABLE DATA'
```

Um `.dump` truncado passa no `ls -lh` e falha aqui.

### Dumps manuais realizados

| Data | Arquivo | Tamanho | TOC / tabelas com dados |
|---|---|---|---|
| 2026-08-25 01:19 | `leadflow-20260825-0119.dump` | 553 MB | 2.481 entradas / 225 tabelas, 0 erros no log |

Banco de origem: PostgreSQL 17.6, 3.213 MB. Cobre a janela sem backup
automático aberta em 18/08.

## Verificação após a correção

```sql
select "startedAt", status, "durationMs", "sizeBytes"
from public.backoffice_database_backups
order by "startedAt" desc
limit 7;
```

Sete execuções seguidas com `status = 'success'` e `sizeBytes` crescendo de
forma plausível fecham o incidente.
