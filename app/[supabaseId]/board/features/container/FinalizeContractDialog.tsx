'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useTimezone } from '@/app/context/TimezoneContext';
import { startOfDayInTz } from '@/lib/dates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

const MAX_CURRENCY_VALUE = 9_999_999_999.99;
const MAX_CURRENCY_LABEL = "10.000.000.000,00";

interface FinalizeContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  onFinalize: (data: FinalizeContractData) => Promise<void>;
}

export interface FinalizeContractData {
  amount: number;
  startDateAt: Date;
  finalizedDateAt: Date;
  notes?: string;
}

export function FinalizeContractDialog({
  open,
  onOpenChange,
  leadName,
  onFinalize,
}: FinalizeContractDialogProps) {
  const { tz } = useTimezone();
  const [amount, setAmount] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>();
  const [finalizedDate, setFinalizedDate] = useState<Date>();
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [amountError, setAmountError] = useState<string>('');

  // Formatar valor como moeda brasileira
  const formatCurrencyDisplay = (value: string): string => {
    // Remove tudo exceto números
    const numbers = value.replace(/\D/g, '');
    
    if (!numbers) return '';
    
    // Converte para número e divide por 100 para ter os centavos
    const numberValue = parseInt(numbers) / 100;
    
    // Formata no padrão brasileiro
    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Converter valor formatado de volta para número
  const parseFormattedValue = (formattedValue: string): number => {
    const numbers = formattedValue.replace(/\D/g, '');
    return parseInt(numbers || '0') / 100;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyDisplay(e.target.value);
    const numericValue = parseFormattedValue(formatted);
    if (numericValue > MAX_CURRENCY_VALUE) {
      setAmountError(`O valor deve ser menor que ${MAX_CURRENCY_LABEL}`);
      return;
    }
    setAmountError('');
    setAmount(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFormattedValue(amount);

    // Validações
    if (!amount || numericAmount <= 0) {
      toast.error('Por favor, insira um valor válido para o contrato.');
      setError('Por favor, insira um valor válido para o contrato.');
      return;
    }

    if (numericAmount > MAX_CURRENCY_VALUE) {
      toast.error(`O valor deve ser menor que ${MAX_CURRENCY_LABEL}`);
      setError(`O valor deve ser menor que ${MAX_CURRENCY_LABEL}`);
      return;
    }

    if (!startDate) {
      toast.error('Por favor, selecione a data de início do contrato.');
      setError('Por favor, selecione a data de início do contrato.');
      return;
    }

    if (!finalizedDate) {
      toast.error('Por favor, selecione a data de finalização do contrato.');
      setError('Por favor, selecione a data de finalização do contrato.');
      return;
    }

    if (finalizedDate < startDate) {
      toast.error('A data de finalização não pode ser anterior à data de início.');
      setError('A data de finalização não pode ser anterior à data de início.');
      return;
    }

    // 🚀 OPTIMISTIC UPDATE - Loading toast
    const loadingToast = toast.loading('Finalizando contrato...');
    setIsLoading(true);
    
    // Fechar dialog imediatamente para UX mais rápida
    onOpenChange(false);

    try {
      await onFinalize({
        amount: parseFormattedValue(amount),
        startDateAt: startOfDayInTz(startDate, tz),
        finalizedDateAt: startOfDayInTz(finalizedDate, tz),
        notes: notes.trim() || undefined,
      });

      // ✅ Sucesso - Toast detalhado com informações do contrato
      toast.success(`Contrato finalizado com sucesso! Valor: R$ ${parseFormattedValue(amount).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`, {
        id: loadingToast,
        duration: 5000,
      });

      // Limpar formulário após sucesso
      setAmount('');
      setStartDate(undefined);
      setFinalizedDate(undefined);
      setNotes('');
      setAmountError('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao finalizar contrato';
      
      // ❌ Erro - Atualizar loading toast
      toast.error(errorMessage, {
        id: loadingToast,
        duration: 5000,
      });
      
      setError(errorMessage);
      
      // Reabrir dialog em caso de erro
      onOpenChange(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setAmount('');
    setStartDate(undefined);
    setFinalizedDate(undefined);
    setNotes('');
    setError('');
    setAmountError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Fechar Contrato</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do contrato para o lead: <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Campo de Valor do Contrato */}
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor do Contrato (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Data de Início */}
            <div className="grid gap-2">
              <Label>Data de Início do Contrato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    weekdayLabelFormat="short"
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Data de Finalização */}
            <div className="grid gap-2">
              <Label>Data de Finalização do Contrato</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal',
                      !finalizedDate && 'text-muted-foreground'
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {finalizedDate ? format(finalizedDate, 'PPP') : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={finalizedDate}
                    onSelect={setFinalizedDate}
                    weekdayLabelFormat="short"
                    initialFocus
                    disabled={(date: Date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notas (Opcional) */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Input
                id="notes"
                placeholder="Adicione observações sobre o contrato..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Mensagem de Erro */}
            {(error || amountError) && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {amountError || error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className='cursor-pointer'>
              {isLoading ? 'Finalizando...' : 'Fechar Contrato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
