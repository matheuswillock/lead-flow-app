'use client'

import { useState } from 'react'
import { PhoneCall } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUserContext } from '@/app/context/UserContext'
import { isManagerLikeRole } from '@/lib/roles'
import { useDialerContext } from '../context/DialerContext'
import { CampaignCard } from '../components/CampaignCard'
import { CreateCampaignDialog } from '../components/CreateCampaignDialog'
import { UploadContactsDialog } from '../components/UploadContactsDialog'
import { ContactsDialog } from '../components/ContactsDialog'

function CampaignsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-2 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function DialerContainer() {
  const { campaigns, loading, error, deleting, handleDeleteCampaign } = useDialerContext()
  const { user } = useUserContext()
  const [uploadCampaignId, setUploadCampaignId] = useState<string | null>(null)
  const [contactsCampaignId, setContactsCampaignId] = useState<string | null>(null)

  const canManage = Boolean(user && (user.isMaster || isManagerLikeRole(user.role)))
  const contactsCampaign = campaigns.find((campaign) => campaign.id === contactsCampaignId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Discadora</h1>
          <p className="text-sm text-muted-foreground">
            Campanhas de ligações automáticas para a base de contatos do time.
          </p>
        </div>
        {canManage && <CreateCampaignDialog />}
      </div>

      {loading ? (
        <CampaignsSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <PhoneCall className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma campanha criada ainda.
              {canManage
                ? ' Crie a primeira campanha e importe a base de contatos.'
                : ' Peça ao manager do time para criar a primeira campanha.'}
            </p>
            {canManage && <CreateCampaignDialog />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              canManage={canManage}
              deleting={deleting === campaign.id}
              onUpload={() => setUploadCampaignId(campaign.id)}
              onViewContacts={() => setContactsCampaignId(campaign.id)}
              onDelete={() => void handleDeleteCampaign(campaign.id)}
            />
          ))}
        </div>
      )}

      <UploadContactsDialog
        campaignId={uploadCampaignId}
        onClose={() => setUploadCampaignId(null)}
      />
      <ContactsDialog
        campaignId={contactsCampaignId}
        campaignName={contactsCampaign?.name ?? null}
        onClose={() => setContactsCampaignId(null)}
      />
    </div>
  )
}
