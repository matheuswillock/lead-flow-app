"use client"

import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useBackofficePaymentProviders } from "../context/BackofficePaymentProvidersContext"
import { ConfirmActionDialog, type PendingConfirmation } from "./ConfirmActionDialog"
import { ProviderCredentialsSection } from "./ProviderCredentialsSection"
import { ProviderHistorySection } from "./ProviderHistorySection"
import { ProviderIdentitySection } from "./ProviderIdentitySection"
import { ProviderOperationSection } from "./ProviderOperationSection"
import { ProviderStatusBadges } from "./ProviderStatusBadges"

export function ProviderInstanceSheet() {
  const { selectedInstance, selectInstance, busyInstanceId } = useBackofficePaymentProviders()
  const [pending, setPending] = useState<PendingConfirmation | null>(null)

  return (
    <>
      <Sheet open={selectedInstance !== null} onOpenChange={(open) => !open && selectInstance(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b p-4">
            <SheetTitle>{selectedInstance?.displayName ?? "Instância"}</SheetTitle>
            <SheetDescription>
              {selectedInstance
                ? `${selectedInstance.providerKey} · conta ${selectedInstance.externalAccountContext}`
                : ""}
            </SheetDescription>
            {selectedInstance && <ProviderStatusBadges instance={selectedInstance} />}
          </SheetHeader>
          {selectedInstance && (
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
              <ProviderOperationSection instance={selectedInstance} onRequestConfirmation={setPending} />
              <Separator />
              <ProviderCredentialsSection instance={selectedInstance} onRequestConfirmation={setPending} />
              <Separator />
              <ProviderIdentitySection key={`${selectedInstance.id}-${selectedInstance.configRevision}`} instance={selectedInstance} />
              <Separator />
              <ProviderHistorySection configId={selectedInstance.id} />
            </div>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmActionDialog pending={pending} isBusy={busyInstanceId !== null} onClose={() => setPending(null)} />
    </>
  )
}
