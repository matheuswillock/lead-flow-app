import { backofficeContractUseCase } from "@/app/api/useCases/backofficeContract/BackofficeContractUseCase";
import { PublicContractProvider } from "./features/context/PublicContractContext";
import { PublicContractContainer } from "./features/container/PublicContractContainer";
import type { PublicContractShare } from "./features/context/PublicContractTypes";

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const output = await backofficeContractUseCase.resolvePublicShare(token);
  const initialShare: PublicContractShare | null =
    output.isValid && output.result ? (output.result as PublicContractShare) : null;

  return (
    <PublicContractProvider token={token} initialShare={initialShare}>
      <PublicContractContainer />
    </PublicContractProvider>
  );
}
