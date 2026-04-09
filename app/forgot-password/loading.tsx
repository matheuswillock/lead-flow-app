import { Loader2 } from 'lucide-react';

export default function ForgotPasswordLoading() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 md:p-10">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Carregando...</p>
      </div>
    </main>
  );
}
