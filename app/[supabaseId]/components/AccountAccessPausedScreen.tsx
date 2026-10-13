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

export const SUBSCRIPTION_SUPPORT_WHATSAPP_URL =
  `https://wa.me/5511939534668?text=${encodeURIComponent("Olá! Minha conta do Corretor Studio está com o acesso pausado e preciso de orientação sobre os próximos passos.")}`

type AccountAccessPausedScreenProps = {
  reason?: AccountAccessRestrictionReason
  isBillingOwner?: boolean
}

export function AccountAccessPausedScreen({
  isBillingOwner = false,
  reason,
}: AccountAccessPausedScreenProps) {
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
            {reason === "banned"
              ? "Fale com o time de assinaturas para entender como seguir."
              : isBillingOwner
                ? "Fale com o time de assinaturas para regularizar o acesso desta conta."
                : "Avise o administrador desta conta para que ele entre em contato com o time de assinaturas."}
          </p>
        </CardContent>
        <CardFooter className="flex-col gap-3">
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
