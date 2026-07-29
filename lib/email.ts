import { createHash } from "node:crypto"
import { Resend } from "resend"

// Only instantiate when key exists.
export const resend: Resend | null = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null

export function assertResend(): Resend {
	if (!resend) {
		throw new Error("Missing RESEND_API_KEY env var")
	}
	return resend
}

const RESEND_IDEMPOTENCY_KEY_MAX_LENGTH = 256

/** Stable key for Resend retries — format: `<event-type>/<entity-id>` (max 256 chars). */
export function buildResendIdempotencyKey(eventType: string, entityId: string): string {
	const key = `${eventType}/${entityId}`
	return key.length > RESEND_IDEMPOTENCY_KEY_MAX_LENGTH
		? key.slice(0, RESEND_IDEMPOTENCY_KEY_MAX_LENGTH)
		: key
}

/** Same entity + same payload variant reuses the key; payload changes rotate the key (e.g. new invite URL). */
export function buildResendIdempotencyKeyWithVariant(
	eventType: string,
	entityId: string,
	variant: string
): string {
	const digest = createHash("sha256").update(variant).digest("hex").slice(0, 16)
	return buildResendIdempotencyKey(eventType, `${entityId}/${digest}`)
}

/** Batch sends use `batch-<event-type>/<batch-id>` per Resend API contract. */
export function buildResendBatchIdempotencyKey(eventType: string, batchId: string): string {
	return buildResendIdempotencyKey(`batch-${eventType}`, batchId)
}
