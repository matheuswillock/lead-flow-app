import { Resend } from "resend"

// Logs de configuração do Resend
console.info('🔍 [Resend] Configuração carregada');
console.info('🔍 [Resend] RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
if (process.env.RESEND_API_KEY) {
  const key = process.env.RESEND_API_KEY;
  console.info('🔍 [Resend] API Key preview:', `${key.slice(0, 6)}...${key.slice(-4)}`);
}

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
