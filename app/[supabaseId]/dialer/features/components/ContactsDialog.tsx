'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDialerContext } from '../context/DialerContext'
import { createDialerService } from '../services/DialerService'
import type { DialerContactsPage } from '../context/DialerTypes'

const service = createDialerService()

interface ContactsDialogProps {
  campaignId: string | null
  campaignName: string | null
  onClose: () => void
}

export function ContactsDialog({ campaignId, campaignName, onClose }: ContactsDialogProps) {
  const { supabaseId, activeTeamId } = useDialerContext()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<DialerContactsPage | null>(null)
  const [loading, setLoading] = useState(false)
  const isFetchingRef = useRef(false)

  const fetchContacts = useCallback(
    async (targetPage: number) => {
      if (!campaignId || isFetchingRef.current) return
      isFetchingRef.current = true
      setLoading(true)
      try {
        const contactsPage = await service.listContacts(
          supabaseId,
          campaignId,
          targetPage,
          activeTeamId
        )
        setData(contactsPage)
        setPage(targetPage)
      } catch (error) {
        console.error('[ContactsDialog] Failed to fetch contacts', error)
      } finally {
        isFetchingRef.current = false
        setLoading(false)
      }
    },
    [campaignId, supabaseId, activeTeamId]
  )

  useEffect(() => {
    if (campaignId) {
      setData(null)
      void fetchContacts(1)
    }
  }, [campaignId, fetchContacts])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setData(null)
      setPage(1)
      onClose()
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <Dialog open={campaignId !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contatos da campanha</DialogTitle>
          <DialogDescription>
            {campaignName ? `${campaignName} — ` : ''}
            {data ? `${data.total} contatos na fila` : 'Carregando contatos...'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {loading || !data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="text-muted-foreground">{contact.position}</TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.email ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={contact.processed ? 'secondary' : 'outline'}>
                        {contact.processed ? 'Processado' : 'Na fila'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <span className="text-sm text-muted-foreground self-center">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => void fetchContacts(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => void fetchContacts(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
