'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTeamContext } from '@/app/context/TeamContext'
import type { DialerCampaign, DialerState, UploadContactsResult } from './DialerTypes'
import { createDialerService } from '../services/DialerService'
import type { CreateDialerCampaignData } from '../services/IDialerService'

const service = createDialerService()

export interface UseDialerReturn extends DialerState {
  supabaseId: string
  activeTeamId: string | null
  fetchCampaigns: () => Promise<void>
  handleCreateCampaign: (data: CreateDialerCampaignData) => Promise<DialerCampaign | null>
  handleDeleteCampaign: (campaignId: string) => Promise<void>
  handleUploadContacts: (campaignId: string, file: File) => Promise<UploadContactsResult | null>
}

export function useDialer(supabaseId: string): UseDialerReturn {
  const { activeTeamId, isLoading: teamLoading } = useTeamContext()
  const [campaigns, setCampaigns] = useState<DialerCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const isFetchingRef = useRef(false)
  const lastFetchedTeamRef = useRef<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    if (teamLoading) return
    if (!activeTeamId) {
      setCampaigns([])
      setLoading(false)
      setError('Selecione um time para visualizar campanhas')
      return
    }

    if (isFetchingRef.current) {
      console.info('[useDialer] Fetch already in-flight, skipping')
      return
    }

    isFetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      console.info('[useDialer] Fetching campaigns')
      const data = await service.listCampaigns(supabaseId, activeTeamId)
      setCampaigns(data)
      lastFetchedTeamRef.current = activeTeamId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar campanhas'
      console.error('[useDialer] Failed to fetch campaigns', err)
      setError(message)
    } finally {
      isFetchingRef.current = false
      setLoading(false)
    }
  }, [supabaseId, activeTeamId, teamLoading])

  useEffect(() => {
    if (teamLoading) return
    if (activeTeamId && lastFetchedTeamRef.current === activeTeamId) return
    void fetchCampaigns()
  }, [fetchCampaigns, activeTeamId, teamLoading])

  const handleCreateCampaign = useCallback(
    async (data: CreateDialerCampaignData): Promise<DialerCampaign | null> => {
      if (creating) return null
      setCreating(true)
      try {
        const campaign = await service.createCampaign(supabaseId, data, activeTeamId)
        setCampaigns((current) => [campaign, ...current])
        toast.success('Campanha criada com sucesso')
        return campaign
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar campanha'
        console.error('[useDialer] Failed to create campaign', err)
        toast.error(message)
        return null
      } finally {
        setCreating(false)
      }
    },
    [supabaseId, activeTeamId, creating]
  )

  const handleDeleteCampaign = useCallback(
    async (campaignId: string) => {
      if (deleting) return
      setDeleting(campaignId)
      try {
        await service.deleteCampaign(supabaseId, campaignId, activeTeamId)
        setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId))
        toast.success('Campanha excluída com sucesso')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir campanha'
        console.error('[useDialer] Failed to delete campaign', err)
        toast.error(message)
      } finally {
        setDeleting(null)
      }
    },
    [supabaseId, activeTeamId, deleting]
  )

  const handleUploadContacts = useCallback(
    async (campaignId: string, file: File): Promise<UploadContactsResult | null> => {
      if (uploading) return null
      setUploading(true)
      try {
        const result = await service.uploadContacts(supabaseId, campaignId, file, activeTeamId)
        toast.success(`${result.inserted} contatos importados`)
        lastFetchedTeamRef.current = null
        await fetchCampaigns()
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao enviar contatos'
        console.error('[useDialer] Failed to upload contacts', err)
        toast.error(message)
        return null
      } finally {
        setUploading(false)
      }
    },
    [supabaseId, activeTeamId, uploading, fetchCampaigns]
  )

  return {
    supabaseId,
    activeTeamId,
    campaigns,
    loading,
    error,
    creating,
    uploading,
    deleting,
    fetchCampaigns,
    handleCreateCampaign,
    handleDeleteCampaign,
    handleUploadContacts,
  }
}
