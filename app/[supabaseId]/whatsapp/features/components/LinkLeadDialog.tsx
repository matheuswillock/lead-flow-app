"use client"

import { useCallback, useRef, useState } from 'react'
import { Link2, Loader2, Search, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import type { LeadSearchResult, WhatsAppConversation } from '../context/WhatsAppInboxTypes'

interface LinkLeadDialogProps {
  selectedConversation: WhatsAppConversation
}

export function LinkLeadDialog({ selectedConversation }: LinkLeadDialogProps) {
  const { linkLead, searchLeads, isLinkingLead } = useWhatsAppInboxContext()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LeadSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (!value.trim()) {
        setResults([])
        return
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true)
        try {
          const found = await searchLeads(value)
          setResults(found)
        } finally {
          setIsSearching(false)
        }
      }, 400)
    },
    [searchLeads]
  )

  const handleSelect = useCallback(
    (lead: LeadSearchResult) => {
      linkLead(selectedConversation.id, lead.id)
      setOpen(false)
      setQuery('')
      setResults([])
    },
    [linkLead, selectedConversation.id]
  )

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery('')
      setResults([])
    }
  }

  const isLinked = selectedConversation.leadId !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={isLinkingLead}
        >
          <Link2 className="size-3.5" />
          {isLinked ? 'Lead vinculado' : 'Vincular lead'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular lead</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>

          <Separator />

          {isSearching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 && query.trim() ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum lead encontrado para &ldquo;{query}&rdquo;
            </p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Digite o nome ou telefone do lead para buscar
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {results.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={isLinkingLead}
                  onClick={() => handleSelect(lead)}
                >
                  <User className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.phone ?? lead.email ?? lead.leadCode}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
