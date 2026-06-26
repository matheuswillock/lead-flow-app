"use client";

import { WebPushConsentDialog } from "./WebPushConsentDialog";
import { useWebPushConsentPrompt } from "../hooks/useWebPushConsentPrompt";

type WebPushConsentPromptProps = {
  supabaseId: string;
};

export function WebPushConsentPrompt({ supabaseId }: WebPushConsentPromptProps) {
  const { isOpen, isLoading, isSupported, accept, dismiss, decline, setIsOpen } =
    useWebPushConsentPrompt({
      supabaseId,
      source: "login_prompt",
    });

  if (!isSupported) {
    return null;
  }

  return (
    <WebPushConsentDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      isLoading={isLoading}
      onAccept={accept}
      onDismiss={dismiss}
      onDecline={decline}
    />
  );
}
