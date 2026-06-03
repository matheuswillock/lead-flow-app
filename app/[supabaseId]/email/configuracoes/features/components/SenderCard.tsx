"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"

export function SenderCard() {
  const { loading, saving, fromName, fromEmail, replyTo, setFromName, setFromEmail, setReplyTo } =
    useEmailSettingsContext()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Remetente padrão</CardTitle>
        <CardDescription>
          Nome e endereço de email exibidos como remetente nos disparos de campanha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fromName">Nome do remetente *</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                disabled={saving}
                placeholder="Ex: Corretor Studio"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fromEmail">Email do remetente *</Label>
              <Input
                id="fromEmail"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                disabled={saving}
                placeholder="Ex: no-reply@corretorstudio.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="replyTo">Reply-to (opcional)</Label>
              <Input
                id="replyTo"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                disabled={saving}
                placeholder="Ex: contato@seudominio.com"
              />
              <p className="text-xs text-muted-foreground">
                Endereço para onde as respostas dos destinatários serão direcionadas.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
