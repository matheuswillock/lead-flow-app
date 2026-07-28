"use client"

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectionCard } from '../components/ConnectionCard'
import { TagManagerCard } from '../components/TagManagerCard'
import { OpsSloCard } from '../components/OpsSloCard'

export function WhatsAppSettingsContainer() {
  const { supabaseId } = useParams<{ supabaseId: string }>()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-semibold">Configurações do WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie a conexão e as configurações do canal WhatsApp do seu time.
        </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
          <Link href={`/${supabaseId}/docs?chapter=whatsapp-inbox`}>
            <BookOpen className="size-4" />
            Como configurar
          </Link>
        </Button>
      </div>
      <ConnectionCard />
      <OpsSloCard />
      <TagManagerCard />
    </div>
  )
}
