export type ResendWebhookPayload = {
  type: string
  data: {
    email_id: string
    created_at: string
    to?: string[]
    tags?: Record<string, string> | Array<{ name: string; value: string }>
    click?: { link: string; userAgent: string; ipAddress: string }
    bounce?: { message: string }
  }
}
