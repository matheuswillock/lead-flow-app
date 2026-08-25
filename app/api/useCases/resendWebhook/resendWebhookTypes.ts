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
    bounce?: {
      message: string
      type?: string
      subType?: string
      diagnosticCode?: string[]
    }
    /**
     * `record` é o propósito (`DKIM`, `SPF`, `Tracking`, `TrackingCAA`,
     * `Receiving`) e decide se o registro é pré-requisito de ENTREGA. Opcional
     * porque o provedor nem sempre o envia — `deriveSendingDnsVerified` responde
     * `undefined` nesse caso e a escrita preserva o valor atual, em vez de
     * gravar "DNS de envio quebrado" por falta de rótulo.
     */
    records?: Array<{ status?: string; record?: string }>
    open_tracking?: boolean
    click_tracking?: boolean
  }
}

export type ResendDomainWebhookPayload = ResendWebhookPayload & {
  type: `domain.${string}`
  data: ResendWebhookPayload["data"] & { id: string }
}
