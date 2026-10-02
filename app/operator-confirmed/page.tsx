import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { OperatorConfirmedContainer } from "./features/container/OperatorConfirmedContainer";
import { OperatorConfirmedProvider } from "./features/context/OperatorConfirmedContext";

function OperatorConfirmedFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Loader2 className="size-16 animate-spin text-primary motion-reduce:animate-none" />
          </div>
          <CardTitle className="text-2xl">Carregando...</CardTitle>
        </CardHeader>
      </Card>
    </main>
  );
}

export default function OperatorConfirmedPage() {
  return (
    <Suspense fallback={<OperatorConfirmedFallback />}>
      <OperatorConfirmedProvider>
        <OperatorConfirmedContainer />
      </OperatorConfirmedProvider>
    </Suspense>
  );
}
