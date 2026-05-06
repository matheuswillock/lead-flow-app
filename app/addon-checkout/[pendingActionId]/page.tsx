import { AddOnCheckoutProvider } from "./features/context/AddOnCheckoutContext";
import { AddOnCheckoutContainer } from "./features/container/AddOnCheckoutContainer";

interface AddOnCheckoutPageProps {
  params: Promise<{ pendingActionId: string }>;
}

export const metadata = {
  title: "Checkout - Corretor Studio",
  description: "Complete seu pagamento para ativar seu novo add-on",
};

export default async function AddOnCheckoutPage({ params }: AddOnCheckoutPageProps) {
  const { pendingActionId } = await params;

  return (
    <AddOnCheckoutProvider>
      <AddOnCheckoutContainer pendingActionId={pendingActionId} />
    </AddOnCheckoutProvider>
  );
}
