import { MessageCircle } from "lucide-react"
import type { AccountAccessRestrictionReason } from "@/app/api/shared/accountAccessDecision/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import { AccountAccessRecoveryButton } from "./AccountAccessRecoveryButton"

export const SUBSCRIPTION_SUPPORT_WHATSAPP_URL =
  "https://wa.me/5511939534668?text=Ol%C3%A1%2C%20Bruno%21%20Minha%20assinatura%20do%20Corretor%20Studio%20expirou%20e%20gostaria%20de%20renovar.%20Voc%C3%AA%20pode%20me%20orientar%20sobre%20os%20pr%C3%B3ximos%20passos%3F"

type AccountAccessPausedScreenProps = {
  reason?: AccountAccessRestrictionReason
  isBillingOwner?: boolean
}

export function AccountAccessPausedScreen({ isBillingOwner = false, reason }: AccountAccessPausedScreenProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="leading-none font-semibold">Seu acesso está pausado</h1>
          <CardDescription>
            {reason === "past_due" ? "Esta conta está com um pagamento pendente." : "Esta conta está com o acesso pausado."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {reason === "banned" ? "Fale com o time de assinaturas para entender como seguir." : isBillingOwner && reason === "past_due"
              ? "Regularize a assinatura para voltar a usar o Corretor Studio."
              : "Peça ao responsável pela assinatura para regularizar o pagamento."}
          </p>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          {isBillingOwner && reason === "past_due" ? (
            <AccountAccessRecoveryButton />
          ) : null}
          <Button asChild className="h-11 w-full" variant={isBillingOwner ? "outline" : "default"}>
            <a href={SUBSCRIPTION_SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer">
              <MessageCircle data-icon="inline-start" />
              Falar com o time de assinaturas
            </a>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
