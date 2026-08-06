import type { WhatsAppConfig } from '../context/WhatsAppSettingsTypes'

export type ConnectionCardViewState =
  | { kind: 'no-config' }
  | { kind: 'initializing' }
  | { kind: 'qr-ready'; qrCodeImageUrl: string }
  | { kind: 'connected'; engine: string | undefined }
  | { kind: 'disconnected-awaiting-qr' }
  | { kind: 'has-config' }

export function getConnectionCardViewState(
  config: WhatsAppConfig | null
): ConnectionCardViewState {
  if (!config) return { kind: 'no-config' }

  if (config.status === 'INITIALIZING') return { kind: 'initializing' }

  if (config.status === 'QR_READY' && config.qrCodeImageUrl) {
    return { kind: 'qr-ready', qrCodeImageUrl: config.qrCodeImageUrl }
  }

  if (config.status === 'CONNECTED') {
    return { kind: 'connected', engine: config.engine }
  }

  if (config.status === 'DISCONNECTED' && !config.qrCodeImageUrl && !config.primaryConfigId) {
    return { kind: 'disconnected-awaiting-qr' }
  }

  return { kind: 'has-config' }
}
