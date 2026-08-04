import { EmailUnsubscribeUseCase } from "@/app/api/useCases/email/EmailUnsubscribeUseCase";
import { EmailUnsubscribeContainer } from "./features/container/EmailUnsubscribeContainer";
import { EmailUnsubscribeProvider } from "./features/context/EmailUnsubscribeContext";
import type { EmailUnsubscribeInfo } from "./features/context/EmailUnsubscribeTypes";

export default async function EmailUnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const useCase = new EmailUnsubscribeUseCase();
  const output = await useCase.getInfo(token);
  const initialInfo: EmailUnsubscribeInfo | null =
    output.isValid && output.result ? (output.result as EmailUnsubscribeInfo) : null;

  return (
    <EmailUnsubscribeProvider token={token} initialInfo={initialInfo}>
      <EmailUnsubscribeContainer />
    </EmailUnsubscribeProvider>
  );
}
