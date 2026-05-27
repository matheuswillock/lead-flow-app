# Evidências — Fase 2 (Consolidação pós-estabilização)

## Período de observação

- Janela considerada: 24–48h após ativação do fluxo centralizado de conexão Google.
- Objetivo: confirmar estabilidade sem dual-write e sem regressão no agendamento/refresh.

## Evidências funcionais registradas

- Conexão Google no `Minha Conta > Conexões` persiste vínculo via `googleConnectionId`.
- Desconexão Google respeita dependência real de backoffice sem `googleConnectionId` próprio (`force=true` somente quando necessário).
- Reconexão com mesmo email Google reativa conexão (tokens atualizados e `revokedAt` limpo ao atualizar credenciais).
- Backoffice resolve organizer via conexão própria ou profile vinculado, mantendo criação/cancelamento de eventos.

## Evidências técnicas registradas

- Escrita centralizada aplicada no repositório de perfil (`updateGoogleCalendarAuth` sem persistência legada de tokens/campos `google*`).
- Rotas de connect/disconnect ajustadas para leitura/decisão com base na conexão central (`google_oauth_connections`).
- Proteção de ruído de notificação: evento de “Google conectado” só em transição real de conexão.

## Verificações executadas

- `bun run typecheck` ✅
- `bun run lint` ✅ (com warnings preexistentes fora do escopo)
- `bun run governance:check` ✅ (com warnings recorrentes já conhecidos)

## Resultado da Fase 2

- Fase 2 concluída com fluxo estabilizado sem dual-write e com evidências de comportamento esperado.
