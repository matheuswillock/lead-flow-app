'use client';

// app/subscribe/features/components/SubscriptionError.tsx
import { AlertCircle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SubscriptionErrorProps {
  error: string;
  onRetry: () => void;
}

export function SubscriptionError({ error, onRetry }: SubscriptionErrorProps) {
  // Verificar se é um erro de assinatura já ativa
  const isAlreadyActive = error.includes('assinatura ativa') || error.includes('Faça login');
  
  return (
    <div className="rounded-lg border bg-card p-8">
      <div className="text-center">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          isAlreadyActive 
            ? 'bg-blue-100 dark:bg-blue-900/20' 
            : 'bg-red-100 dark:bg-red-900/20'
        }`}>
          <AlertCircle className={`h-10 w-10 ${
            isAlreadyActive 
              ? 'text-blue-600 dark:text-blue-400' 
              : 'text-red-600 dark:text-red-400'
          }`} />
        </div>
        
        <h2 className="text-2xl font-bold mb-2">
          {isAlreadyActive ? 'Assinatura Encontrada' : 'Erro ao Processar Assinatura'}
        </h2>
        
        <Alert variant={isAlreadyActive ? 'default' : 'destructive'} className="my-6 text-left">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{isAlreadyActive ? 'Informação' : 'Erro'}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          {isAlreadyActive ? (
            <>
              <Button asChild variant="default" size="lg">
                <Link href="/sign-in">
                  <LogIn className="mr-2 h-5 w-5" />
                  Fazer Login
                </Link>
              </Button>
              <Button onClick={onRetry} variant="outline" size="lg">
                Tentar com Outro Email
              </Button>
            </>
          ) : (
            <Button onClick={onRetry} variant="default" size="lg">
              Tentar Novamente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
