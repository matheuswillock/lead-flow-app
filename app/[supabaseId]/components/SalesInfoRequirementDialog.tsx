'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { useTimezone } from '@/app/context/TimezoneContext';

const MAX_CURRENCY_VALUE = 9_999_999_999.99;
const MAX_CURRENCY_LABEL = '10.000.000.000,00';

export type MissingSalesField = 'ticket' | 'contractDueDate' | 'soldPlan';

export interface SalesInfoPayload {
  ticket: number;
  contractDueDate: string;
  soldPlan: string;
}

export interface SalesInfoInitialValues {
  ticket: number | null;
  contractDueDate: string | null;
  soldPlan: string | null;
}

interface SalesInfoRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SalesInfoPayload) => Promise<void>;
  healthPlans: { id: string; name: string }[];
  initialValues?: SalesInfoInitialValues;
  missingFields?: MissingSalesField[];
  isSaving?: boolean;
  leadName?: string;
}

const formatCurrencyDisplay = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const numberValue = parseInt(numbers, 10) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrency = (value: string): number => {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers || '0', 10) / 100;
};

const toDisplayFromNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseDate = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

const fieldLabelMap: Record<MissingSalesField, string> = {
  ticket: 'ticket',
  contractDueDate: 'data de vigência',
  soldPlan: 'plano vendido',
};

export function SalesInfoRequirementDialog({
  open,
  onOpenChange,
  onSave,
  healthPlans,
  initialValues,
  missingFields = [],
  isSaving = false,
  leadName,
}: SalesInfoRequirementDialogProps) {
  const { tz } = useTimezone();
  const [ticket, setTicket] = useState('');
  const [contractDueDate, setContractDueDate] = useState<Date | undefined>(undefined);
  const [soldPlan, setSoldPlan] = useState('');
  const [ticketError, setTicketError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTicket(toDisplayFromNumber(initialValues?.ticket));
    setContractDueDate(parseDate(initialValues?.contractDueDate));
    setSoldPlan(initialValues?.soldPlan ?? '');
    setTicketError('');
  }, [open, initialValues?.contractDueDate, initialValues?.soldPlan, initialValues?.ticket]);

  const handleTicketChange = (value: string) => {
    const formatted = formatCurrencyDisplay(value);
    const numericValue = parseCurrency(formatted);
    if (numericValue > MAX_CURRENCY_VALUE) {
      setTicketError(`O valor deve ser menor que ${MAX_CURRENCY_LABEL}`);
      setTicket(formatted);
      return;
    }
    if (formatted && numericValue <= 0) {
      setTicketError('O ticket deve ser maior que R$ 0,00');
      setTicket(formatted);
      return;
    }
    setTicketError('');
    setTicket(formatted);
  };

  const missingText = useMemo(() => {
    if (!missingFields.length) return null;
    return missingFields.map((field) => fieldLabelMap[field]).join(', ');
  }, [missingFields]);

  const handleSubmit = async () => {
    const parsedTicket = parseCurrency(ticket);
    if (parsedTicket <= 0) {
      setTicketError('O ticket deve ser maior que R$ 0,00');
      return;
    }
    if (!contractDueDate) {
      toast.error('Informe a data de vigência do contrato.');
      return;
    }
    if (!soldPlan) {
      toast.error('Selecione o plano vendido.');
      return;
    }

    await onSave({
      ticket: parsedTicket,
      contractDueDate: contractDueDate.toISOString(),
      soldPlan,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Informações de venda obrigatórias</DialogTitle>
          <DialogDescription>
            {leadName
              ? `Preencha os dados de venda para continuar a movimentação do lead ${leadName}.`
              : 'Preencha os dados de venda para continuar a movimentação do lead.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {missingText ? (
            <p className="text-xs text-muted-foreground">
              Campos pendentes: {missingText}.
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="sales-ticket">Ticket (Valor Vendido) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="sales-ticket"
                value={ticket}
                onChange={(event) => handleTicketChange(event.target.value)}
                className="pl-10"
                placeholder="0,00"
                disabled={isSaving}
                inputMode="numeric"
              />
            </div>
            {ticketError ? <p className="text-xs text-destructive">{ticketError}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label>Data de Vigência do Contrato *</Label>
            <DateTimePicker
              date={contractDueDate}
              onDateChange={setContractDueDate}
              label=""
              showTime={false}
              disablePastDates={false}
              disabled={isSaving}
              tz={tz}
            />
          </div>

          <div className="grid gap-2">
            <Label>Plano Vendido *</Label>
            <Select
              value={soldPlan}
              onValueChange={setSoldPlan}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano vendido" />
              </SelectTrigger>
              <SelectContent>
                {healthPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.name}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar e continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
