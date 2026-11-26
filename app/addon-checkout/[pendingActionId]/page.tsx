import { redirect } from "next/navigation";

import { NO_INDEX_METADATA } from "@/lib/metadata/policies";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AddOnCheckoutProvider } from "./features/context/AddOnCheckoutContext";
import { AddOnCheckoutContainer } from "./features/container/AddOnCheckoutContainer";

interface AddOnCheckoutPageProps {
  params: Promise<{ pendingActionId: string }>;
}

export const metadata = {
  ...NO_INDEX_METADATA,
  title: "Checkout - Corretor Studio",
  description: "Complete seu pagamento para ativar seu novo add-on",
};

/** Checkout de add-on: exige login e volta ao app da conta depois da confirmação. */
export default async function AddOnCheckoutPage({ params }: AddOnCheckoutPageProps) {
  const { pendingActionId } = await params;
  const supabase = await createSupabaseServer();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/addon-checkout/${pendingActionId}`)}`);
  }

  return (
    <AddOnCheckoutProvider>
      <AddOnCheckoutContainer pendingActionId={pendingActionId} accountHref={`/${user.id}/dashboard`} />
    </AddOnCheckoutProvider>
  );
}
