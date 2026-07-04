"use client"

import { ConnectionCard } from '../components/ConnectionCard'
import { TagManagerCard } from '../components/TagManagerCard'

export function WhatsAppSettingsContainer() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações do WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie a conexão e as configurações do canal WhatsApp do seu time.
        </p>
      </div>
      <ConnectionCard />
      <TagManagerCard />
    </div>
  )
}
