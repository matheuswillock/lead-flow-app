import { redirect } from "next/navigation";

/**
 * Rota legada de link de PIX (P2-6 da SPEC 41): antes devolvia `return null`
 * — tela em branco pós-pagamento para qualquer link antigo ainda em
 * circulação. `checkout-return` agora tem estado honesto de confirmação
 * (verificação real, nunca "confirmado" sem consulta — DA1/P1-3), então o
 * link legado só precisa chegar lá.
 */
export default function PixConfirmedPage() {
  redirect("/checkout-return");
}
