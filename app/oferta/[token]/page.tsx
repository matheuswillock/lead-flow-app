import { backofficeLeadOfferUseCase } from "@/app/api/useCases/backofficeLeadOffer/BackofficeLeadOfferUseCase";
import { PublicOfferProvider } from "./features/context/PublicOfferContext";
import { PublicOfferContainer } from "./features/container/PublicOfferContainer";
import type { PublicOfferShare } from "./features/context/PublicOfferTypes";

export default async function PublicOfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const output = await backofficeLeadOfferUseCase.resolvePublicOffer(token);
  const initialShare: PublicOfferShare | null =
    output.isValid && output.result ? (output.result as PublicOfferShare) : null;

  return (
    <PublicOfferProvider token={token} initialShare={initialShare}>
      <PublicOfferContainer />
    </PublicOfferProvider>
  );
}
