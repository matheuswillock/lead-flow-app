-- Backfill da classificação de origem dos eventos de abertura HISTÓRICOS.
--
-- Contexto (medição de 17/09): o pixel de abertura mede majoritariamente o
-- pré-fetch do provedor (image proxy do Gmail, Apple MPP, scanners), não a
-- leitura humana. O histórico não tem user-agent/IP persistidos para opens,
-- então a única heurística disponível é o delta entrega→abertura:
--
--   occurredAt - deliveredAt < 120s  -> bot (estimado, botSource generic)
--   resto (inclusive sem deliveredAt) -> unknown (estimado)
--
-- ATENÇÃO — vieses conhecidos, documentados de propósito:
--   * `EmailLog.deliveredAt` e `EmailEvent.occurredAt` históricos foram ambos
--     carimbados com `data.created_at` do payload do Resend (hora de CRIAÇÃO
--     do e-mail, constante por mensagem), não com a hora real do evento. O
--     delta histórico tende a ~0s, então a quase totalidade dos opens
--     históricos cai em `bot (estimado)` — coerente com a decisão do owner de
--     que o histórico não tem sinal humano confiável.
--   * `EmailLog.humanOpenedAt` NÃO é backfillado: sem UA/IP no histórico não
--     existe evidência positiva de humanidade; "Aberturas reais" começa a
--     contar do deploy do classificador em diante.
--
-- Idempotente: só toca eventos `opened` sem chave `origin` no metadata.
-- Em lotes de 10.000 para não segurar lock longo na tabela de eventos.

do $$
declare
  affected integer;
begin
  loop
    with batch as (
      select e."id",
             (
               l."deliveredAt" is not null
               and e."occurredAt" - l."deliveredAt" < interval '120 seconds'
             ) as is_estimated_bot
      from "public"."corretor_studio_email_events" e
      join "public"."corretor_studio_email_logs" l on l."id" = e."logId"
      where e."type" = 'opened'::"public"."email_event_type"
        and (e."metadata" is null or e."metadata" -> 'origin' is null)
      order by e."id"
      limit 10000
    )
    update "public"."corretor_studio_email_events" e
    set "metadata" = coalesce(e."metadata", '{}'::jsonb) || jsonb_build_object(
      'origin',
      case
        when batch.is_estimated_bot then jsonb_build_object(
          'classification', 'bot',
          'botSource', 'generic',
          'estimated', true
        )
        else jsonb_build_object(
          'classification', 'unknown',
          'estimated', true
        )
      end
    )
    from batch
    where e."id" = batch."id";

    get diagnostics affected = row_count;
    exit when affected = 0;
  end loop;
end
$$;
