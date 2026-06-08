# Spec: Scheduled team email broadcasts

This feature lets each team schedule mass email broadcasts for their audience at distinct times, with execution triggered after the scheduled time has passed. The system uses the database as the source of truth and a single Vercel Cron job as the lightweight orchestrator.

## Background

Teams need the ability to create multiple scheduled broadcasts per day without creating one cron per schedule. The current decision is to keep the scheduling model inside the app stack and avoid introducing a separate queue service for the first version.

The main pain point is scalability of scheduler management, not just raw volume. If each team can create up to 10 schedules and the platform grows to many teams, per-schedule cron jobs become expensive to manage and operationally brittle.

## Goals

- Allow each team to create, edit, pause, and delete scheduled email broadcasts.
- Execute broadcasts after the scheduled time has passed, not exactly at the minute boundary.
- Keep a single cron orchestrator instead of one cron per schedule.
- Persist schedule state, execution state, and errors in the database.
- Support retries and safe reprocessing for transient failures.

## Non-Goals

- We are not implementing a third-party queue service in this version.
- We are not guaranteeing exact minute-level execution.
- We are not building a generic workflow engine for arbitrary jobs.
- We are not redesigning the email provider layer beyond what broadcast execution needs.

## Design

### Technical Approach

The system uses a database-driven scheduler model:

- `scheduled_email_jobs` stores each team broadcast schedule and its current status.
- A single Vercel Cron endpoint runs every few minutes and fetches overdue jobs.
- The cron endpoint locks jobs before processing to prevent duplicate execution.
- The job execution service loads recipients, validates eligibility, sends the emails, and updates the execution state.
- Failures are recorded per job so they can be retried or inspected later.

This approach keeps the source of truth in Postgres and uses Vercel only as the orchestrator, which fits the current project decision and avoids a cron-per-job model.

### Data Model

#### `scheduled_email_jobs`

- `id`: UUID primary key.
- `teamId`: foreign key to the owning team.
- `scheduledAt`: datetime when the job becomes eligible for dispatch.
- `status`: `pending`, `queued`, `sending`, `sent`, `failed`, `paused`, `canceled`.
- `payload`: JSON payload with campaign data, filters, and broadcast metadata.
- `attempts`: integer count of execution attempts.
- `lockedAt`: datetime used to claim the job for execution.
- `dispatchedAt`: datetime when execution started or completed, depending on final state.
- `lastError`: text field with the latest failure reason.
- `createdAt` / `updatedAt`: audit timestamps.

#### `scheduled_email_job_runs`

- `id`: UUID primary key.
- `jobId`: foreign key to `scheduled_email_jobs`.
- `status`: `started`, `succeeded`, `failed`.
- `startedAt`: datetime.
- `finishedAt`: datetime.
- `errorMessage`: text field for runtime failures.
- `providerMessageId`: optional external email provider identifier.

#### Optional recipient tracking

If per-recipient auditing is needed later, a separate table can be introduced for delivery tracking. That is intentionally deferred until the first version proves the aggregate job model is enough.

### API

#### Scheduled job management

- `POST /api/v1/email/schedules`
  - Creates a new scheduled broadcast for a team.
- `GET /api/v1/email/schedules`
  - Lists the team schedules.
- `GET /api/v1/email/schedules/[id]`
  - Returns schedule details and execution history.
- `PATCH /api/v1/email/schedules/[id]`
  - Updates schedule metadata, timing, or filters.
- `POST /api/v1/email/schedules/[id]/pause`
  - Pauses a pending schedule.
- `POST /api/v1/email/schedules/[id]/resume`
  - Resumes a paused schedule.
- `DELETE /api/v1/email/schedules/[id]`
  - Cancels a schedule.

#### Cron orchestrator

- `GET /api/v1/email/cron/dispatch-scheduled`
  - Protected by `CRON_SECRET`.
  - Finds overdue jobs.
  - Claims eligible jobs.
  - Sends them to the execution service.
  - Updates status and execution history.

#### Response rules

- HTTP routes return `Output` objects where applicable.
- Unauthorized cron calls return `401`.
- Validation errors return `400`.
- Runtime failures return `500`.

### UI/UX

#### User flow

1. The team opens the scheduling screen.
2. They define recipients, subject, content, send time, and filters.
3. They save the schedule as `pending`.
4. The UI shows the next run time and current state.
5. They can pause, resume, edit, or cancel a schedule before it runs.
6. After dispatch, the UI shows success, partial failure, or failed state with the last error.

#### States

- Loading: show skeletons while fetching schedule lists and details.
- Empty: show that no schedules are configured yet.
- Scheduled: show the next execution time and a pending badge.
- Running: show that dispatch is in progress.
- Sent: show successful completion and totals.
- Failed: show the last error and retry information.
- Paused: show that the schedule will not execute until resumed.

#### Feedback

- Use badges for schedule state.
- Use toasts for creation, update, pause, resume, and cancel feedback.
- Show the last run and next run time explicitly to reduce ambiguity.

## Edge Cases & Error Handling

- A schedule becomes eligible while the cron run is already processing a previous batch. The job lock prevents double execution.
- Two cron invocations overlap. The first successful lock wins; the second skips the already claimed job.
- A schedule is deleted or paused right before execution. The orchestrator rechecks status before sending.
- The email provider fails after recipients have partially been sent. The job is marked as partial or failed, and the run record preserves the provider error.
- The recipient list is empty when the job runs. The job is marked failed with a descriptive error.
- The content payload is malformed or missing required fields. Validation fails before dispatch.
- The cron endpoint is called without a valid secret. The request is rejected with `401`.
- The database is temporarily unavailable. The cron run fails without changing job state, so the next run can retry.

## Security & Privacy

- Scheduled broadcasts may contain PII in recipient filters, email content, and metadata. Access must remain team-scoped.
- The cron endpoint must be protected by `CRON_SECRET` and not exposed publicly.
- Authorization for user-facing routes must follow the project access helpers and team context rules.
- Logged errors must avoid leaking full recipient lists, tokens, or secret headers.
- Email content and payloads must be validated server-side to prevent malformed or injected data from reaching the provider.

## Testing Strategy

- Unit tests:
  - schedule state transitions
  - lock acquisition logic
  - overdue job selection rules
  - validation of required payload fields
- Integration tests:
  - cron endpoint authorization
  - dispatch flow against test data
  - status updates after successful and failed sends
  - pause/resume behavior
- E2E tests:
  - create a schedule
  - wait for the next eligible window
  - confirm that dispatch occurs after the scheduled time
- Manual testing:
  - overlapping cron runs
  - schedule cancellation before execution
  - empty recipient lists
  - provider failure and retry behavior

## Success Criteria

- Teams can create and manage multiple scheduled broadcasts.
- A single Vercel Cron endpoint can dispatch overdue jobs for all teams.
- A job is never executed twice because of overlapping cron runs.
- Schedule state and execution history are visible after each run.
- Transient failures are recorded and can be retried safely.
- Execution happens after the scheduled time, with an acceptable delay window defined by the cron interval.

## Open Questions

- [ ] What is the exact cron interval: every 1 minute, every 5 minutes, or another cadence?
- [ ] Do we need per-recipient delivery tracking in the first version, or is job-level tracking enough?
- [ ] What is the maximum allowed recipient count per scheduled broadcast?
- [ ] Should retries happen automatically inside the cron flow or only manually via the UI?
- [ ] Do paused schedules preserve their original scheduled time or recalculate on resume?

## Decisions Log

> **Q:** Should each team schedule become its own cron job?
> **A:** No. Use a single Vercel Cron orchestrator and store the schedule in the database.

> **Q:** Should execution happen exactly at the scheduled minute?
> **A:** No. Execute after the scheduled time has passed, which keeps the model simpler and more scalable.

> **Q:** Should we introduce a queue service now?
> **A:** No. Keep the first version on Vercel Cron plus database state, and revisit a queue only if the volume or reliability requirements change.
