import { redirect } from "next/navigation";

import { getServerSessionUserId } from "@/lib/supabase/server-session-user";
import { BillingGracePaymentProvider } from "./features/context/BillingGracePaymentContext";
import { BillingGracePaymentContainer } from "./features/container/BillingGracePaymentContainer";

interface BillingGracePaymentPageProps {
  params: Promise<{ supabaseId: string }>;
}

/**
 * Regularização da assinatura do master. Fora do shell da conta: exige sessão e só o dono
 * da conta (o próprio id na URL) vê o checkout; os demais voltam ao próprio dashboard.
 */
export default async function BillingGracePaymentPage({ params }: BillingGracePaymentPageProps) {
  const { supabaseId } = await params;
  const userId = await getServerSessionUserId();

  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(`/pagamento/${supabaseId}`)}`);
  }
  if (userId !== supabaseId) {
    redirect(`/${userId}/dashboard`);
  }

  return (
    <BillingGracePaymentProvider>
      <BillingGracePaymentContainer />
    </BillingGracePaymentProvider>
  );
}
