# Spec: Resend Email Analytics Backend

This spec covers the analytics side of email processing. Resend remains the provider that sends emails, and its webhooks become the source of truth for delivery and engagement events such as delivered, opened, clicked, bounced, and complained.

## Background

The app already needs to know more than whether an email was sent. Product analytics depends on whether messages were delivered and how users interacted with them afterward.

The current design keeps dispatch and analytics separate:

- dispatch records send success or failure
- webhooks record delivery and engagement events
- the analytics endpoint reads aggregated state from the database

That separation avoids conflating provider acceptance with actual delivery and user engagement.

## Goals

- Receive and validate Resend webhook events.
- Correlate provider events back to the original `EmailLog` using `resendEmailId`.
- Persist a durable event history with `EmailEvent`.
- Update per-recipient timestamps and status in `EmailLog`.
- Update campaign aggregates so the UI can render analytics quickly.
- Handle duplicates and out-of-order events without regressing status.

## Non-Goals

- Scheduling or dispatching campaigns.
- Replacing Resend as the email provider.
- Polling Resend for metrics instead of using webhooks.
- Per-recipient analytics UI beyond what the current log model supports.

## Design

### Technical Approach

- Resend sends the email and returns a `resendEmailId`.
- The send flow persists that identifier in `EmailLog`.
- The `POST /api/webhooks/resend` endpoint receives provider events signed with Svix.
- The webhook handler finds the matching `EmailLog`, inserts an `EmailEvent`, updates the log timestamps and status, and increments the campaign counters.
- The `GET /api/v1/email/analytics` endpoint reads aggregated totals and rates from the persisted records.

This makes the analytics read model deterministic and auditable.

### Data Model

The analytics layer uses the existing email tables:

#### `EmailCampaign`

- Stores campaign-level totals such as sent, delivered, opened, clicked, bounced, and complained.
- Acts as the aggregated read model for the UI.

#### `EmailLog`

- Tracks one recipient-level send.
- Stores `resendEmailId`, recipient metadata, status, and event timestamps.
- Status should move forward only when a newer event is more specific.

#### `EmailEvent`

- Stores each webhook event as a timestamped history record.
- Keeps the raw metadata needed for auditability and future reconciliation.

### API

#### Webhook ingestion

- `POST /api/webhooks/resend`
  - Validates the Svix signature.
    - Maps Resend event types into internal event types.
      - Ignores unsupported or malformed events safely.
        - Is idempotent enough to tolerate retries and duplicates.

        Supported event families:

        - `email.sent`
        - `email.delivered`
        - `email.opened`
        - `email.clicked`
        - `email.bounced`
        - `email.complained`

        Additional events such as `delivery_delayed` and `unsubscribed` can be stored if needed, but they do not drive the core campaign summary in this phase.

        #### Analytics read model

        - `GET /api/v1/email/analytics`
          - Reads totals and rates by period.
            - Supports campaign filtering.
              - Uses the persisted database state instead of recalculating in the client.

              ### Operational Setup

              - The Resend dashboard must be configured to send webhooks to the public `/api/webhooks/resend` endpoint.
              - The webhook secret must be stored as `RESEND_WEBHOOK_SECRET`.
              - The team needs a clear process for verifying webhook delivery in staging and production.
              - Logs should include `resendEmailId`, `campaignId`, event type, and correlation outcome, but never sensitive payload content.

              ### UI/UX

              - The analytics dashboard shows sent, delivered, opened, clicked, bounced, and complained totals.
              - Campaign rows should reflect send state separately from delivery metrics.
              - The UI should not wait on polling; it should render from the read model updated by webhooks.

              ## Edge Cases & Error Handling

              - Webhook signature invalid: reject the request.
              - Webhook delivered more than once: process safely without double counting.
              - Event arrives out of order: keep the most specific or highest-priority status.
              - `EmailLog` not found for `resendEmailId`: ignore safely and log the mismatch.
              - Bounce or complaint arrives after delivery/open/click: keep the later analytics event and update contact flags as needed.
              - A campaign has no metrics yet: analytics must return zeros, not errors.

              ## Security & Privacy

              - Webhooks are public endpoints but must be authenticated by Svix signature validation.
              - Recipient metadata and event payloads may contain PII and must be treated as sensitive.
              - Logs must not expose full recipient lists or webhook secrets.
              - The analytics routes must remain team-scoped through the existing access model.

              ## Testing Strategy

              - Unit tests:
                - event type mapping
                  - status priority rules
                    - aggregation increments
                      - correlation by `resendEmailId`
                      - Integration tests:
                        - webhook signature validation
                          - `EmailEvent` persistence
                            - `EmailLog` timestamp updates
                              - campaign counter updates
                                - no-op handling when the log is missing
                                - Regression tests:
                                  - duplicate webhooks
                                    - out-of-order events
                                      - bounce followed by open/click
                                        - send success followed by delayed delivery event
                                        - Manual checks:
                                          - send a test campaign
                                            - confirm `resendEmailId` is stored
                                              - confirm delivery/open/click events appear in analytics

                                              ## Success Criteria

                                              - Resend webhooks update the analytics model correctly.
                                              - Send success remains distinct from delivery and engagement metrics.
                                              - Campaign analytics are accurate after duplicate or out-of-order events.
                                              - The UI reads pre-aggregated metrics from the backend.
                                              - No manual polling is required to compute delivery or engagement status.

                                              ## Decisions Log

                                              > **Q:** Should analytics be calculated from the UI or the backend?
                                              > **A:** Backend only. The UI consumes pre-aggregated data.

                                              > **Q:** Should delivery and engagement be derived from dispatch success?
                                              > **A:** No. Dispatch success comes from the send flow; delivery and engagement come from webhooks.

                                              > **Q:** Should the first phase add a new queue or polling job for analytics?
                                              > **A:** No. Use Resend webhooks as the source of truth.

                                              