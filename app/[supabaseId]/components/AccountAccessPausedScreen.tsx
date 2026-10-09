import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const SUBSCRIPTION_SUPPORT_WHATSAPP_URL =
  "https://wa.me/5511939534668?text=Ol%C3%A1%2C%20Bruno%21%20Minha%20assinatura%20do%20Corretor%20Studio%20expirou%20e%20gostaria%20de%20renovar.%20Voc%C3%AA%20pode%20me%20orientar%20sobre%20os%20pr%C3%B3ximos%20passos%3F"

export function AccountAccessPausedScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Seu acesso está pausado</CardTitle>
          <CardDescription>
            A assinatura desta conta precisa ser renovada para continuar usando o Corretor Studio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fale com nosso time de assinaturas para receber orientação sobre a renovação.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
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
