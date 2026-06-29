"use client"

import { Skeleton } from '@/components/ui/skeleton'
import { useWhatsAppAutoResponsesContext } from '../context/WhatsAppAutoResponsesContext'
import { RuleCard } from '../components/RuleCard'

export function WhatsAppAutoResponsesContainer() {
  const { rules, isLoading } = useWhatsAppAutoResponsesContext()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Auto-respostas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure mensagens automáticas de boas-vindas, fora do horário e por palavra-chave.
        </p>
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
