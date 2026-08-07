# OpenWA Spec 01 — Cutover checklist

## Estado do codebase (Fase E)

- Camada produto `evo/` e webhook `/api/webhooks/whatsapp/evolution/` removidos.
- `WhatsAppEngineFactory` e `OpenWaWhatsAppProvider` são o caminho padrão do produto.
- `docker-compose.vps.yml` inclui serviço `openwa` (sem Evolution do produto).
- **Bethânia** ainda usa Evolution (`backofficeBot/evo`, `docker-compose.evolution.yml`) — Spec 02.

## Smoke (piloto 1 time)

1. Subir `openwa` no compose da VPS (`docker-compose.vps.yml`).
2. Configurar `OPENWA_*` na Vercel / `.env` local.
3. No Corretor Studio, reconectar WhatsApp do time piloto.
4. Validar: status INITIALIZING → QR_READY → scan → CONNECTED.
5. Enviar texto, receber inbound, mark-as-read.
6. Observar 48h sem incidentes.

## Cutover produto

1. Parar container `evolution_api` do produto na VPS (Bethânia pode manter Evolution até Spec 02).
2. Monitorar reconexões orgânicas (1–5 dias úteis).
3. Após estabilidade: pausar/exportar projeto Supabase Evolution dedicado (`kzwzgkfgynfwodjmfdli`) **somente com autorização + backup**.

## Não fazer sem autorização

- `db:migrate:push` remoto
- Deletar projeto Supabase Evolution sem backup explícito
- Remover stack Bethânia/Evolution (Spec 02)
