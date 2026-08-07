import { describe, it, expect } from 'bun:test'
import { getConnectionCardViewState } from './connectionCardViewState'
import type { WhatsAppConfig } from '../context/WhatsAppSettingsTypes'

function makeConfig(overrides: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    teamId: 'team-1',
    provider: 'OPENWA',
    engine: 'OPENWA',
    status: 'CONNECTED',
    instanceName: 'inst-1',
    phoneNumber: null,
    normalizedPhone: null,
    lastConnectedNormalizedPhone: null,
    primaryConfigId: null,
    qrCodeImageUrl: null,
    qrCodeText: null,
    usageLimitMonthly: 2000,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastSyncAt: null,
    historySyncStatus: 'IDLE',
    historySyncStartedAt: null,
    historySyncCompletedAt: null,
    historySyncError: null,
    ...overrides,
  }
}

describe('getConnectionCardViewState', () => {
  it('returns no-config when config is null', () => {
    expect(getConnectionCardViewState(null)).toEqual({ kind: 'no-config' })
  })

  it('returns initializing when status is INITIALIZING', () => {
    expect(getConnectionCardViewState(makeConfig({ status: 'INITIALIZING' }))).toEqual({
      kind: 'initializing',
    })
  })

  it('returns qr-ready when QR_READY with image', () => {
    const result = getConnectionCardViewState(
      makeConfig({ status: 'QR_READY', qrCodeImageUrl: 'https://example.com/qr.png' })
    )
    expect(result).toEqual({ kind: 'qr-ready', qrCodeImageUrl: 'https://example.com/qr.png' })
  })

  it('returns has-config when QR_READY without image', () => {
    expect(
      getConnectionCardViewState(makeConfig({ status: 'QR_READY', qrCodeImageUrl: null }))
    ).toEqual({ kind: 'has-config' })
  })

  it('returns connected with engine when CONNECTED', () => {
    expect(getConnectionCardViewState(makeConfig({ status: 'CONNECTED', engine: 'OPENWA' }))).toEqual(
      { kind: 'connected', engine: 'OPENWA' }
    )
  })

  it('returns connected with undefined engine when engine is absent', () => {
    const config = makeConfig({ status: 'CONNECTED' })
    delete config.engine
    expect(getConnectionCardViewState(config)).toEqual({ kind: 'connected', engine: undefined })
  })

  it('returns disconnected-awaiting-qr when DISCONNECTED without QR and not shared', () => {
    expect(
      getConnectionCardViewState(
        makeConfig({ status: 'DISCONNECTED', qrCodeImageUrl: null, primaryConfigId: null })
      )
    ).toEqual({ kind: 'disconnected-awaiting-qr' })
  })

  it('returns has-config when DISCONNECTED with shared number', () => {
    expect(
      getConnectionCardViewState(
        makeConfig({ status: 'DISCONNECTED', qrCodeImageUrl: null, primaryConfigId: 'other-id' })
      )
    ).toEqual({ kind: 'has-config' })
  })
})
