"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWhatsAppAutoResponsesContext } from '../context/WhatsAppAutoResponsesContext'
import { RuleCard } from '../components/RuleCard'

export function WhatsAppAutoResponsesContainer() {
  const { rules, isLoading } = useWhatsAppAutoResponsesContext()
  const { supabaseId } = useParams<{ supabaseId: string }>()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-semibold">Auto-respostas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure mensagens automáticas de boas-vindas, fora do horário e por palavra-chave.
        </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
          <Link href={`/${supabaseId}/docs?chapter=whatsapp-auto-respostas`}>
            <BookOpen className="size-4" />
            Regras de uso
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </div>
  )
}
