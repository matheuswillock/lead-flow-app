'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { FinalizeContractDependent } from './FinalizeContractDialog';

const PARENTESCO_OPTIONS = [
  { value: 'pai',      label: 'Pai' },
  { value: 'mae',      label: 'Mãe' },
  { value: 'filho',    label: 'Filho(a)' },
  { value: 'conjuge',  label: 'Cônjuge' },
  { value: 'sobrinho', label: 'Sobrinho(a)' },
  { value: 'neto',     label: 'Neto(a)' },
  { value: 'avo',      label: 'Avô/Avó' },
  { value: 'tio',      label: 'Tio(a)' },
  { value: 'irmao',    label: 'Irmão/Irmã' },
];

interface AddDependentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dep: FinalizeContractDependent) => void;
  initialData?: FinalizeContractDependent;
}

export function AddDependentModal({ open, onOpenChange, onSave, initialData }: AddDependentModalProps) {
  const [name, setName]             = useState('');
  const [birthDate, setBirthDate]   = useState<Date | undefined>();
  const [parentesco, setParentesco] = useState('');
  const [document, setDocument]     = useState('');

  useEffect(() => {
    if (open) {
      setName(initialData?.name ?? '');
      setBirthDate(initialData?.birthDate ?? undefined);
      setParentesco(initialData?.parentesco ?? '');
      setDocument(initialData?.document ?? '');
    }
  }, [open, initialData]);

  const isValid = name.trim().length > 0 && !!birthDate && parentesco.length > 0;

  const handleSave = () => {
    if (!isValid || !birthDate) return;
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      name: name.trim(),
      birthDate,
      parentesco,
      document: document.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar dependente' : 'Adicionar dependente'}</DialogTitle>
          <DialogDescription>
            Preencha os dados do dependente. Documento é opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="dep-name">Nome *</Label>
            <Input
              id="dep-name"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Data de Nascimento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn('justify-start text-left font-normal', !birthDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {birthDate ? format(birthDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  required={false}
                  selected={birthDate}
                  onSelect={setBirthDate}
                  locale={ptBR}
                  captionLayout="dropdown"
                  fromYear={1920}
                  toYear={new Date().getFullYear()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Parentesco *</Label>
            <Select value={parentesco} onValueChange={setParentesco}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o parentesco" />
              </SelectTrigger>
              <SelectContent>
                {PARENTESCO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dep-doc">Documento (opcional)</Label>
            <Input
              id="dep-doc"
              placeholder="CPF, RG..."
              value={document}
              onChange={(e) => setDocument(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!isValid} onClick={handleSave}>
            {initialData ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
