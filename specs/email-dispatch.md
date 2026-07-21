# Spec: Scheduled Email Dispatch

This spec covers team-scoped scheduling and dispatch of email campaigns. A single Vercel Cron endpoint finds overdue jobs, claims them, and triggers Resend. Dispatch success and failure are tracked separately from delivery analytics.

## Background

Teams need multiple broadcast schedules per day without creating one cron per schedule. The current pain point is scheduler scalability, not just raw send volume.

The target design keeps scheduling state in the database and uses Vercel only as a lightweight orchestrator. That keeps the implementation simple and avoids introducing an external queue in this phase.

## Goals

- Allow each team to create, update, pause, resume, and cancel scheduled email broadcasts.
- Execute broadcasts after the scheduled time has passed.
- Keep a single cron orchestrator instead of one cron per schedule.
- Persist schedule state, execution attempts, and errors in the database.
- Store the `resendEmailId` returned by the sender so analytics can correlate later.

## Non-Goals

- Delivery/open/click analytics.
- A third-party queue service.
- Exact minute-level execution guarantees.
- A generic workflow engine for non-email jobs.

## Design

### Technical Approach

The system uses a database-backed job model:

- `scheduled_email_jobs` stores one row per scheduled broadcast.
- `scheduled_email_job_runs` records each execution attempt and outcome.
- A single Vercel Cron endpoint runs every few minutes, finds overdue jobs, and claims them before dispatch.
- The job execution service loads recipients, validates the payload, sends the email through Resend, and records the send result.
- Sending success means the provider accepted the message; it does not mean delivery was confirmed.

This keeps the scheduling source of truth in Postgres and prevents a cron-per-job design.

### Data Model

#### `scheduled_email_jobs`

- `id`: UUID primary key.
- `teamId`: owning team.
- `campaignId`: optional link to the campaign being dispatched.
- `scheduledAt`: timestamp when the job becomes eligible for dispatch.
- `status`: `pending`, `queued`, `sending`, `sent`, `failed`, `paused`, `canceled`.
- `payload`: JSON payload with recipients, template data, and broadcast metadata.
- `attempts`: number of execution attempts.
- `lockedAt`: claim marker used by the cron runner.
- `dispatchedAt`: timestamp when dispatch started or completed.
- `lastError`: last execution failure.
- `createdAt` / `updatedAt`: audit timestamps.

#### `scheduled_email_job_runs`

- `id`: UUID primary key.
- `jobId`: foreign key to `scheduled_email_jobs`.
- `status`: `started`, `succeeded`, `failed`.
- `startedAt`: timestamp.
- `finishedAt`: timestamp.
- `errorMessage`: execution failure details.
- `providerMessageId`: Resend message identifier when available.

### API

#### Schedule management

- `POST /api/v1/email/schedules`
  - Create a new scheduled broadcast.
- `GET /api/v1/email/schedules`
  - List team schedules.
- `GET /api/v1/email/schedules/[id]`
  - Fetch one schedule and its runs.
- `PATCH /api/v1/email/schedules/[id]`
  - Update timing or payload before execution.
- `POST /api/v1/email/schedules/[id]/pause`
  - Pause a pending schedule.
- `POST /api/v1/email/schedules/[id]/resume`
  - Resume a paused schedule.
- `DELETE /api/v1/email/schedules/[id]`
  - Cancel a schedule.

#### Cron orchestrator

- `GET /api/v1/email/cron/dispatch-scheduled`
  - Protected by `CRON_SECRET`.
  - Selects overdue jobs.
  - Claims each job before dispatch.
  - Calls the send service.
  - Persists the send outcome and `resendEmailId`.

### UI/UX

- The scheduling screen shows upcoming jobs, the last run, and the next eligible run.
- Schedule rows display clear status badges: pending, queued, sending, sent, failed, paused, canceled.
- The UI allows pausing, resuming, editing, and canceling before dispatch.
- Failures should show the last error without exposing provider secrets or recipient lists.

## Edge Cases & Error Handling

- Overlapping cron runs must not dispatch the same job twice.
- A schedule paused or deleted right before dispatch must be rechecked before sending.
- Empty recipient sets should fail fast with a descriptive message.
- Resend failures should mark the run failed and preserve the provider error.
- Database failures should leave the job eligible for the next cron run instead of half-updating state.

## Security & Privacy

- Schedule payloads can contain PII and must stay team-scoped.
- The cron endpoint must require `CRON_SECRET`.
- Error logs must not leak full payloads, tokens, or recipient lists.
- User-facing routes must follow the project access helpers and team authorization rules.

## Testing Strategy

- Unit tests:
  - overdue job selection
  - lock acquisition
  - state transitions
  - send-result mapping
- Integration tests:
  - cron auth
  - dispatch success
  - dispatch failure
  - pause/resume behavior
  - persisted `resendEmailId`
- Manual checks:
  - create a schedule
  - wait for cron execution
  - confirm the job is sent once
  - confirm failed jobs can be retried safely

## Success Criteria

- Teams can manage multiple scheduled broadcasts.
- A single Vercel Cron endpoint dispatches all overdue jobs.
- A job is never sent twice because of overlapping cron runs.
- Dispatch results are persisted and visible for troubleshooting.
- The send flow does not depend on delivery analytics to complete.

## Decisions Log

> **Q:** Should each schedule become its own cron job?
> **A:** No. Use one Vercel Cron orchestrator and store schedules in the database.

> **Q:** Should dispatch wait for delivery confirmation?
> **A:** No. Dispatch success is separate from delivery analytics and is recorded when Resend accepts the message.

> **Q:** Should we introduce an external queue now?
> **A:** No. Keep this phase on Vercel Cron plus database state.

