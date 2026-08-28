# Runbook — Filas e Crons

Runbook operacional dos alertas e invariantes de fila/cron. Complementa
`agents.md` (governança) e a auditoria CDP 2026-08 §8.

## Dead-letter das filas Vercel

Toda fila usa `ackAfterMaxDeliveries` (`lib/queues/queue-processing-failure.ts`)
como rede de segurança: acima de `QUEUE_MAX_DELIVERY_COUNT` entregas a mensagem
é gravada em `corretor_studio_queue_processing_failures` e ackada, em vez de
retentar para sempre.

A rede de segurança **não pode compartilhar o destino do caminho primário**. Em
22/08 a própria escrita no outbox falhava (2.917 erros) porque a Vercel Queue
reentrega ao deployment que publicou a mensagem — e esse deployment estava
quebrado. Por isso a escrita tem retry próprio e um corte duro.

### Variáveis de ambiente

| Variável | Default | Efeito |
|---|---|---|
| `QUEUE_MAX_DELIVERY_COUNT` | `20` | Entregas antes de mandar a mensagem para o outbox e ackar. |
| `QUEUE_HARD_MAX_DELIVERY_COUNT` | `100` | Teto absoluto: acima dele o consumer acka **mesmo sem conseguir gravar no outbox**. Nunca fica abaixo de `QUEUE_MAX_DELIVERY_COUNT`. |

### Alerta `dead_letter_write_failed`

**Tag:** `dead_letter_write_failed` (constante `DEAD_LETTER_WRITE_FAILED_TAG`).

Emitida via `console.error` quando as 3 tentativas de escrita no outbox
(backoff 200ms → 500ms) falham. Formato:

```
[ackAfterMaxDeliveries] dead_letter_write_failed { tag, topic, idempotencyKey,
  deliveryCount, hardMaxDeliveryCount, attempts, ackedWithoutOutbox,
  outboxError, lastError, payload? }
```

Consulta de alerta (Axiom/Slack) — casar pela string `dead_letter_write_failed`
na mensagem ou pelo campo `tag`.

| Campo | Leitura |
|---|---|
| `ackedWithoutOutbox: false` | A mensagem continua retentando. Ainda dá para recuperar: investigar por que o Postgres/outbox está indisponível. |
| `ackedWithoutOutbox: true` | **Corte duro acionado.** A mensagem foi descartada da fila e o `payload` completo está no próprio log — é a única cópia. Reprocessar manualmente a partir do log se o evento importar. |

**Severidade:** qualquer ocorrência é anômala. `ackedWithoutOutbox: true`
significa perda de dado contida — tratar como incidente.

**Primeira ação:** conferir se a tabela recebe escrita.

```sql
select status, count(*)
from public.corretor_studio_queue_processing_failures
group by status;
```

Tabela vazia durante um cluster de `dead_letter_write_failed` = a escrita está
falhando, não é ausência de falhas.

## Watchdog de execuções de cron órfãs

`GET /api/v1/queues/cron/mark-stale-cron-executions` (`*/15`) encerra execuções
presas em `running`. O kill de plataforma (timeout, OOM, deploy) não passa pelo
`catch` do `withCronAudit`, então sem o watchdog a linha fica `running` para
sempre e o alerta de falha nunca dispara.

O teto é **por `cronKey`** (`app/api/lib/cron/cronStaleThresholds.ts`), nunca
global: `database-backup` (~5min) e `radar-sync-email-contacts` (p95 104s) são
legitimamente longos. Teto = 2× o `maxDuration` declarado na rota.

Execuções encerradas pelo watchdog recebem
`errorSummary = 'stale_running_timeout'` e disparam o alerta Slack de falha de
cron.

Invariante monitorável:

```sql
select count(*)
from public.backoffice_cron_executions
where status = 'running' and "startedAt" < now() - interval '1 hour';
```

Deve ser `0` em regime. Qualquer valor acima de zero por mais de uma janela de
15 minutos significa que o watchdog não está rodando.
