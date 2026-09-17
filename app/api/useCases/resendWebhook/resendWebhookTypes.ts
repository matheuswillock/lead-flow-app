export type ResendWebhookPayload = {
  type: string
  /**
   * Momento em que o EVENTO aconteceu (topo do payload). Diferente de
   * `data.created_at`, que é a hora de CRIAÇÃO do e-mail — constante para
   * todos os eventos da mesma mensagem. Medido em produção (17/09): num
   * email.opened real, `data.created_at` = 16:03 e `created_at` topo =
   * `data.open.timestamp` = 17:39.
   */
  created_at?: string
  data: {
    email_id?: string
    id?: string
    name?: string
    status?: string
    region?: string
    created_at: string
    to?: string[]
    tags?: Record<string, string> | Array<{ name: string; value: string }>
    /** Presente em email.opened: sinais crus do fetch do pixel. */
    open?: { ipAddress?: string; userAgent?: string; timestamp?: string }
    click?: { link: string; userAgent: string; ipAddress: string; timestamp?: string }
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
