'use client'

import { FileUp, ListOrdered, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { DialerCampaign } from '../context/DialerTypes'
import { CampaignStatusBadge } from './CampaignStatusBadge'

interface CampaignCardProps {
  campaign: DialerCampaign
  canManage: boolean
  deleting: boolean
  onUpload: () => void
  onViewContacts: () => void
  onDelete: () => void
}

export function CampaignCard({
  campaign,
  canManage,
  deleting,
  onUpload,
  onViewContacts,
  onDelete,
}: CampaignCardProps) {
  const progress =
    campaign.totalContacts > 0
      ? Math.round((campaign.contactsProcessed / campaign.totalContacts) * 100)
      : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        {campaign.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{campaign.description}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {campaign.contactsProcessed} de {campaign.totalContacts} contatos
          </span>
          <span>{campaign.answerRate}% atendidas</span>
        </div>
        <Progress value={progress} />
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onViewContacts}>
          <ListOrdered data-icon="inline-start" />
          Contatos
        </Button>
        {canManage && (
          <Button variant="outline" size="sm" onClick={onUpload}>
            <FileUp data-icon="inline-start" />
            Importar
          </Button>
        )}
        {canManage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto" disabled={deleting}>
                {deleting ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                <AlertDialogDescription>
                  A campanha &quot;{campaign.name}&quot; e todos os contatos importados serão
                  removidos. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  )
}
