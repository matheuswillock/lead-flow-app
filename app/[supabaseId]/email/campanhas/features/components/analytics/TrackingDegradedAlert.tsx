"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertTriangle, Settings } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TrackingDegradedAlertProps = {
  warnings?: string[] | null
  /**
   * Se o disparo está REALMENTE travado. Vem do servidor, que é quem roda o
   * gate — não pode ser inferido de "a lista de avisos não está vazia".
   */
  blocked?: boolean
}

export function TrackingDegradedAlert({ warnings, blocked = false }: TrackingDegradedAlertProps) {
  const params = useParams<{ supabaseId?: string }>()
  const supabaseId = typeof params.supabaseId === "string" ? params.supabaseId : null

  if (!warnings?.length) return null

  return (
    <Alert className="border-semantic-warning/30 bg-semantic-warning-surface text-foreground">
      <AlertTriangle data-icon="inline-start" className="text-semantic-warning" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {/* O título acompanha o gate. Fixá-lo em "Disparo bloqueado" fazia a
              caixa se contradizer: desde que aviso deixou de implicar bloqueio,
              o time cujo DNS de envio está íntegro lia "Disparo bloqueado" logo
              acima de um corpo dizendo "suas campanhas disparam normalmente" —
              e ao lado de um botão de disparo habilitado. */}
          <AlertTitle>
            {blocked ? "Disparo bloqueado" : "Métricas de abertura indisponíveis"}
          </AlertTitle>
          {/* Renderiza o warning recebido, não uma constante fixa: o gate tem
              duas causas (DNS não verificado e métricas desligadas) e antes a
              tela mandava "habilite as métricas" mesmo quando o bloqueio era o
              DNS — botão que não destrava nada. */}
          {warnings.map((warning) => (
            <AlertDescription key={warning}>{warning}</AlertDescription>
          ))}
        </div>
        {supabaseId ? (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/${supabaseId}/email/configuracoes`}>
              <Settings data-icon="inline-start" />
              Ir para Configurações
            </Link>
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}
