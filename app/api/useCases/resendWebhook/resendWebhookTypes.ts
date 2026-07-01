export type ResendWebhookPayload = {
  type: string
  data: {
    email_id?: string
    id?: string
    name?: string
    status?: string
    region?: string
    created_at: string
    to?: string[]
    tags?: Record<string, string> | Array<{ name: string; value: string }>
    click?: { link: string; userAgent: string; ipAddress: string }
    bounce?: { message: string; type?: string }
    records?: Array<{ status?: string }>
    open_tracking?: boolean
    click_tracking?: boolean
  }
}

export type ResendDomainWebhookPayload = ResendWebhookPayload & {
  type: `domain.${string}`
  data: ResendWebhookPayload["data"] & { id: string }
}
