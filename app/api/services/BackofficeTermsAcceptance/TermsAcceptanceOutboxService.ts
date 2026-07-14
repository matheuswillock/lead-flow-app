import { createHash } from "node:crypto"
import { createEmailService } from "@/lib/email/create-email-service"
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage"
import { getFullUrl } from "@/lib/utils/app-url"
import { TERMS_ACCEPTANCE_PDF_GENERATOR_VERSION, termsAcceptancePdfService } from "./TermsAcceptancePdfService"
import { backofficeTermsAcceptanceRepository } from "@/app/api/infra/data/repositories/backoffice/termsAcceptance/BackofficeTermsAcceptanceRepository"

const LOCK_TIMEOUT_MS = 10 * 60 * 1000
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character)

export class TermsAcceptanceOutboxService {
  private async generateEvidence(acceptanceId: string): Promise<void> {
    const acceptance = await backofficeTermsAcceptanceRepository.findAcceptanceForPdf(acceptanceId)
    if (!acceptance) throw new Error("Aceite não encontrado")
    if (acceptance.pdfStoragePath) return
    const buffer = await termsAcceptancePdfService.render(acceptance)
    const sha256 = createHash("sha256").update(buffer).digest("hex")
    const file = new File([new Uint8Array(buffer)], `comprovante-${acceptance.protocol}.pdf`, { type: "application/pdf" })
    const upload = await SupabaseStorageService.uploadFile(file, STORAGE_BUCKETS.TERMS_ACCEPTANCES, acceptance.id, file.name, "evidence")
    if (!upload.success || !upload.fileId) throw new Error(upload.error ?? "Falha ao armazenar o comprovante")
    await backofficeTermsAcceptanceRepository.markPdfGenerated(acceptance.id, { path: upload.fileId, sha256, version: TERMS_ACCEPTANCE_PDF_GENERATOR_VERSION, at: new Date() })
  }

  private async sendConfirmation(acceptanceId: string): Promise<void> {
    const acceptance = await backofficeTermsAcceptanceRepository.findAcceptanceForConfirmation(acceptanceId)
    if (!acceptance) throw new Error("Aceite não encontrado")
    if (acceptance.emailSentAt) return
    if (!acceptance.pdfStoragePath) throw new Error("Comprovante ainda não foi gerado")
    const supabase = createSupabaseAdmin()
    if (!supabase) throw new Error("Supabase Admin não configurado")
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.TERMS_ACCEPTANCES).download(acceptance.pdfStoragePath)
    if (error || !data) throw new Error("Não foi possível baixar o comprovante")
    const result = await createEmailService().sendEmailUntracked({
      to: [acceptance.representativeEmail],
      subject: `Aceite eletrônico concluído · ${acceptance.protocol}`,
      html: `<p>Olá, ${escapeHtml(acceptance.representativeName)}.</p><p>Seu aceite eletrônico foi registrado com o protocolo <strong>${escapeHtml(acceptance.protocol)}</strong>.</p><p>O comprovante está anexado a este e-mail e também fica disponível na sua conta.</p>`,
      text: `Seu aceite eletrônico foi registrado com o protocolo ${acceptance.protocol}. O comprovante está anexado.`,
      attachments: [{ filename: `comprovante-${acceptance.protocol}.pdf`, content: Buffer.from(await data.arrayBuffer()) }],
      idempotencyKey: `terms-acceptance-confirmation/${acceptance.protocol}`,
    })
    if (!result.success) throw new Error(result.error ?? "Falha ao enviar confirmação")
    await backofficeTermsAcceptanceRepository.markEmailSent(acceptance.id, new Date())
  }

  private async sendPasswordRecovery(acceptanceId: string): Promise<void> {
    const acceptance = await backofficeTermsAcceptanceRepository.findAcceptanceForPassword(acceptanceId)
    if (!acceptance?.adhesion.email) throw new Error("Adesão sem e-mail")
    const supabase = createSupabaseAdmin()
    if (!supabase) throw new Error("Supabase Admin não configurado")
    const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email: acceptance.adhesion.email, options: { redirectTo: getFullUrl("/set-password") } })
    if (error || !data.properties?.action_link) throw new Error("Falha ao gerar recuperação de senha")
    const result = await createEmailService().sendAdhesionCompletedEmail({
      userName: acceptance.adhesion.fullName,
      userEmail: acceptance.adhesion.email,
      setPasswordUrl: buildSetPasswordEmailAuthLink(data, "recovery"),
    })
    if (!result.success) throw new Error(result.error ?? "Falha ao enviar recuperação de senha")
  }

  async dispatchPending(limit = 25): Promise<{ processed: number; failed: number }> {
    const now = new Date()
    const lockBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS)
    const candidates = await backofficeTermsAcceptanceRepository.listOutboxCandidates(now, lockBefore, Math.min(Math.max(limit, 1), 100))
    let processed = 0
    let failed = 0
    for (const event of candidates) {
      const claimed = await backofficeTermsAcceptanceRepository.claimOutbox(event.id, now, lockBefore)
      if (!claimed.count) continue
      try {
        if (event.type === "generate_evidence") await this.generateEvidence(event.acceptanceId)
        if (event.type === "send_confirmation_email") await this.sendConfirmation(event.acceptanceId)
        if (event.type === "send_password_recovery") await this.sendPasswordRecovery(event.acceptanceId)
        await backofficeTermsAcceptanceRepository.updateOutbox(event.id, { status: "completed", completedAt: new Date(), lockedAt: null, lastError: null })
        processed += 1
      } catch (error) {
        const attempts = event.attempts + 1
        await backofficeTermsAcceptanceRepository.updateOutbox(event.id, {
            status: attempts >= event.maxAttempts ? "failed" : "pending",
            lockedAt: null,
            lastError: error instanceof Error ? error.message.slice(0, 2000) : "Erro desconhecido",
            nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
        })
        failed += 1
      }
    }
    return { processed, failed }
  }
}

export const termsAcceptanceOutboxService = new TermsAcceptanceOutboxService()
