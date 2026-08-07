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
  let initialInfo: EmailUnsubscribeInfo | null = null;
  try {
    const output = await useCase.getInfo(token);
    if (output.isValid && output.result) {
      initialInfo = output.result as EmailUnsubscribeInfo;
    }
  } catch (error) {
    console.error("[EmailUnsubscribePage] getInfo failed:", error);
  }

  return (
    <EmailUnsubscribeProvider token={token} initialInfo={initialInfo}>
      <EmailUnsubscribeContainer />
    </EmailUnsubscribeProvider>
  );
}
