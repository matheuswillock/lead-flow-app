# Especificação — Módulo Discadora Automática (Twilio)

> **Histórico de revisões:**
> - v4.0.0 (2026-07-21): Pivô de volta para Twilio Programmable Voice. Clientes em produção na 3C Plus enfrentaram instabilidade crítica; decisão do owner de retornar ao plano original. A auditoria da 3C Plus (`docs/DIALER_3CPLUS_AUDIT.md`) e o spec 3C Plus intermediário (`docs/DIALER_3CPLUS_SPEC.md`) são mantidos como referência histórica.
> - v3.1.0 (2026-07-21): Era o spec 3C Plus — substituído por este documento.
> - v2.1.0 (2026-06-12): Spec Twilio original (`docs/TWILIO_AUTO_DIALER_SPEC.md`) — **este documento é uma atualização direta daquele**, com as simplificações derivadas do Estágio 1 já implementado.

**Versão:** 4.0.0
**Data:** 2026-07-21
**Status:** Estágio 1 implementado — Estágio 2 (provisionamento Twilio) em andamento
**Produto:** Lead Flow — Corretor Studio
**Referência canônica completa:** [`docs/TWILIO_AUTO_DIALER_SPEC.md`](TWILIO_AUTO_DIALER_SPEC.md) v2.2.0 — contém todos os detalhes de arquitetura, billing, jobs, configuração Twilio e fases de PR.

---

## Estado de implementação

| Estágio | Escopo | Status |
|---|---|---|
| **1 — Fundação** | Schema (`DialerCampaign`, `DialerContact`, `DialerCall`, `DialerUsage`, `DialerSubscription`), CRUD de campanha, upload Excel/JSON, frontend de lista de campanhas, feature `voice`, sidebar, proxy | ✅ **Implementado** |
| **2 — Provisionamento Twilio** | `IVoiceProvider` redesenhado, `TwilioVoiceProvider`, stubs de webhooks (`/api/webhooks/twilio/voice` + `/status`), `GET /api/v1/dialer/token`, `lib/webhooks/twilioWebhookSecurity`, env vars Twilio | 🔄 **Em andamento** |
| **3 — Core da discagem** | `StartDialerUseCase`, `DialNextContactUseCase` (claim atômico `FOR UPDATE SKIP LOCKED`), `DialerCallProgressUseCase`, webhooks completos (TwiML Conference + status), `DialerDeviceHook` frontend, watchdog `GET /api/v1/dialer/cron/maintenance` | ⬜ Pendente (bloqueado por Estágio 2) |
| **4 — Painel realtime** | `DialerRealtimeService` (broadcast privado), `TeamCallsPanel`, `useDialerRealtime`, migration policy `realtime.messages` | ⬜ Pendente |
| **5 — Gravações + lead a partir da ligação** | `DialerJob`, `DialerJobService`, archive_recording, `CreateLeadFromCallUseCase`, bloqueio de exclusão de anexo protegido | ⬜ Pendente |
| **6 — Billing Asaas** | `DialerBillingService`, rotas subscription, roteamento `dialer:` no `PaymentValidationService` | ⬜ Pendente |
| **7 — Hardening** | Suspensão de subconta, mascaramento de telefone no painel, rate limit nos webhooks | ⬜ Pendente |

---

## Arquitetura (resumo)

O Twilio é uma API **programável**: o Lead Flow controla quando e para quem discar.

```
Operador clica "Iniciar"
        ↓
StartDialerUseCase → campanha "running" → DialNextContactUseCase
        ↓
TwilioVoiceProvider.initiateCall() — AMD ativo, timeout 15s
        ↓
[Webhook /api/webhooks/twilio/voice]
  ├── AnsweredBy=human → TwiML <Conference> + cria perna do operador (Twilio Client)
  └── machine/no-answer → <Hangup/> → callback de status → próxima discagem
        ↓
[Webhook /api/webhooks/twilio/status]
  Soma minutos → DialerUsage → DialNextContactUseCase → broadcast Realtime
```

- **Subconta por time**: isolamento de billing e recursos (nenhum número compartilhado entre times).
- **Browser SDK**: `@twilio/voice-sdk` (dynamic import client-only); token gerado por `GET /api/v1/dialer/token`.
- **Jobs**: `DialerJob(archive_recording)` — gravação Twilio → Supabase Storage → lead (se aplicável) → delete Twilio.
- **Watchdog**: cron Vercel `*/5min` → `GET /api/v1/dialer/cron/maintenance` reconcilia chamadas órfãs + drena `DialerJob` pendentes.

Para todos os detalhes (tabelas, rotas, UseCases, billing, configuração, custos), ver [`docs/TWILIO_AUTO_DIALER_SPEC.md`](TWILIO_AUTO_DIALER_SPEC.md).
