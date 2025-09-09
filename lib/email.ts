import { Resend } from "resend"

// Evita erro em build quando variável de ambiente não está definida.
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
