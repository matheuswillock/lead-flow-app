import { redirect } from "next/navigation";

import { createSupabaseServer } from "@/lib/supabase/server";
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
  const supabase = await createSupabaseServer();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/pagamento/${supabaseId}`)}`);
  }
  if (user.id !== supabaseId) {
    redirect(`/${user.id}/dashboard`);
  }

  return (
    <BillingGracePaymentProvider>
      <BillingGracePaymentContainer />
    </BillingGracePaymentProvider>
  );
}
