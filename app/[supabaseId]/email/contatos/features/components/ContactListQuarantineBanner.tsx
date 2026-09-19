"use client"

import { useState } from "react"
import { ShieldAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { ContactList } from "../context/ContatosTypes"

type ContactListQuarantineBannerProps = {
  list: ContactList
  readOnly: boolean
  onRelease: () => Promise<void>
}

/**
 * Banner da quarentena do gate de importação: a lista foi classificada como
 * risco ALTO e não entra em audiência de campanha até liberação explícita.
 * O botão de liberar avisa o custo de reputação antes de confirmar.
 */
export function ContactListQuarantineBanner({
  list,
  readOnly,
  onRelease,
}: ContactListQuarantineBannerProps) {
  const [releasing, setReleasing] = useState(false)

  const handleConfirmRelease = async () => {
    if (releasing) return
    setReleasing(true)
    try {
      await onRelease()
    } finally {
      setReleasing(false)
    }
  }

  return (
    <Alert variant="destructive" data-testid="quarantine-banner">
      <ShieldAlert />
      <AlertTitle>Lista em quarentena pelo gate de importação</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          {list.quarantineReason ??
            "A última importação desta lista foi classificada como risco ALTO."}{" "}
          Enquanto estiver em quarentena, a lista não entra em campanhas — partes
          agendadas com ela ficam adiadas.
        </p>
        {!readOnly ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                disabled={releasing}
                data-testid="quarantine-release-trigger"
              >
                Liberar lista mesmo assim
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Liberar lista em quarentena?</AlertDialogTitle>
                <AlertDialogDescription>
                  O gate de importação removeu uma fração alta de endereços desta
                  lista. Disparar para o restante pode gerar bounces e queimar a
                  reputação do seu domínio no Gmail e nos demais provedores —
                  exatamente o dano que a quarentena existe para evitar. Libere
                  somente se você higienizou a origem dos contatos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={releasing}>Manter em quarentena</AlertDialogCancel>
                <AlertDialogAction
                  disabled={releasing}
                  onClick={() => void handleConfirmRelease()}
                  data-testid="quarantine-release-confirm"
                >
                  {releasing ? "Liberando…" : "Assumir o risco e liberar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
