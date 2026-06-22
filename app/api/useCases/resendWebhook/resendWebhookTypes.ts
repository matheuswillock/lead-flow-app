export type ResendWebhookPayload = {
  type: string
  data: {
    email_id: string
    created_at: string
    to?: string[]
    click?: { link: string; userAgent: string; ipAddress: string }
    bounce?: { message: string }
  }
}
