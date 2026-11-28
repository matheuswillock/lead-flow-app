# Bethânia Hermes sender (local)

This transport binds to `127.0.0.1` only. Set a fresh local `BETHANIA_WEBHOOK_SECRET` (never commit it), then run:

```sh
BETHANIA_WEBHOOK_SECRET='local-development-secret' bun run scripts/bethania-hermes/server.ts
```

Optional settings: `BETHANIA_WEBHOOK_PORT` (default `8787`) and `BETHANIA_HERMES_PROFILE` (default `bethania-local`). The profile must already be configured; this runbook does not pair it. Health check: `curl -i http://127.0.0.1:8787/healthz`.

App requests are `POST /events` with JSON `{ "eventId", "eventType", "phone", "message" }`, signed over the exact raw body using `X-Bethania-Timestamp` (Unix seconds) and `X-Bethania-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + rawBody)>`. The accepted event types are `schedule.created_or_rescheduled`, `agenda.daily_0700`, `meeting.follow_up_1h`, `agenda.overdue_1500`, and `account.whatsapp_verification` (the last is reserved for a server-generated one-time verification code). Timestamps may differ from server time by at most 300 seconds. A `202` means Hermes CLI accepted the request, not that a handset delivered it. Transport failures return a generic `502`; this server does not retry. The app outbox owns idempotency and retries.

Automated tests use an injected fake sender and local ephemeral HTTP ports; they never invoke Hermes CLI or WhatsApp. Run them with `bun --no-env-file test --isolate scripts/bethania-hermes`.

## Local app worker (manual only)

The app exposes `GET /api/v1/notifications/cron/bethania-agenda`, authenticated with the existing `CRON_SECRET` bearer token. Each invocation selects verified profiles, plans due agenda events, enqueues them idempotently, then dispatches at most 50 pending items when a sender URL is saved in the Bethânia backoffice and `BETHANIA_SENDER_SECRET` is configured. The app URL used in follow-up links comes from `NEXT_PUBLIC_APP_URL` or `VERCEL_URL`.

Agenda/outbox and account WhatsApp verification both use the sender URL saved in Bethânia backoffice; the HMAC signing key remains in `BETHANIA_SENDER_SECRET`. No production cron schedule is registered for the agenda route. Do not call it while a real sender URL is saved in backoffice and the secret is configured; it can send real WhatsApp messages. For safe local scheduling tests, leave the backoffice sender URL unset and use the service tests with a fake repository/transport. This route is not a substitute for local end-to-end acceptance with an isolated database and fake sender.

## One-recipient real-send smoke (manual only)

`real-send-smoke.ts` exercises the signed app-to-sender HTTP boundary and the dedicated Hermes CLI profile, but deliberately bypasses the CRM/outbox. It requires explicit confirmation, a recipient matching the local guard, and `bethania-local`; it checks the loopback bridge health, sends exactly one fixed test message, and does not retry. The committed guard uses a fictional placeholder recipient. For any real smoke, configure the test recipient only in a private local copy and never commit personal numbers. Run only after the user has authorized the specific test:

```sh
BETHANIA_REAL_SEND_CONFIRM=I_ACKNOWLEDGE_REAL_WHATSAPP_SEND BETHANIA_TEST_RECIPIENT=+15550123456 BETHANIA_HERMES_PROFILE=bethania-local bun scripts/bethania-hermes/real-send-smoke.ts
```

A successful run means the local webhook accepted the signed request and the Hermes CLI exited successfully. It does not prove handset receipt; ask the recipient to confirm. Never run this script as part of CI or automated test suites.
