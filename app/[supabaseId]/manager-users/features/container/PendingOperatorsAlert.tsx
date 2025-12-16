"use client";

import { Clock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PendingOperatorsAlertProps {
  count: number;
}

export function PendingOperatorsAlert({ count }: PendingOperatorsAlertProps) {
  if (count === 0) return null;

  return (
    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <div className="flex-1">
          <AlertTitle className="text-yellow-800 dark:text-yellow-200 mb-1">
            {count} operador{count > 1 ? 'es' : ''} em processamento
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm">
            {count > 1 
              ? 'Os status dos operadores serão atualizados automaticamente após a confirmação dos pagamentos.'
              : 'O status do operador será atualizado automaticamente após a confirmação do pagamento.'}
          </AlertDescription>
        </div>
        <RefreshCw className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
      </div>
    </Alert>
  );
}
