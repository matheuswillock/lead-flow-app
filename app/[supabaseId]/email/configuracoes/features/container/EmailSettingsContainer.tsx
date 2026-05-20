"use client"

import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"

export function EmailSettingsContainer() {
  const {
    loading,
    saving,
    fromName,
    fromEmail,
    replyTo,
    setFromName,
    setFromEmail,
    setReplyTo,
    handleSave,
  } = useEmailSettingsContext()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Configurações de Email</h1>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Remetente padrão</CardTitle>
          <CardDescription>
            Nome e endereço de email exibidos como remetente nos disparos de campanha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="fromName">Nome do remetente *</Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  disabled={saving}
                  placeholder="Ex: Corretor Studio"
                />
              </div>

              <div className="space-y-2">
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

              <div className="space-y-2">
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

              <Button
                onClick={() => void handleSave()}
                disabled={saving || !fromName.trim() || !fromEmail.trim()}
              >
                {saving ? "Salvando..." : "Salvar configurações"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
