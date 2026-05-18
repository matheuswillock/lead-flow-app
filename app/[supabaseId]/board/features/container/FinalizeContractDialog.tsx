'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { formatDocumentInput, formatRgCpfInput, sanitizeDocumentDigits, sanitizeRgCpfDigits } from '@/lib/masks';
import { AddDependentModal } from './AddDependentModal';
import type { UserAssociated } from '@/app/api/v1/profiles/DTO/profileResponseDTO';

const MAX_CURRENCY_VALUE = 9_999_999_999.99;
const MAX_CURRENCY_LABEL = '10.000.000.000,00';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export interface FinalizeContractDependent {
  id: string;
  name: string;
  birthDate: Date;
  parentesco: string;
  document?: string;
}

export interface FinalizeContractHolder {
  name: string;
  birthDate: Date;
  document: string;
  cnpj?: string;
}

export interface FinalizeContractData {
  amount: number;
  startDateAt: Date;
  finalizedDateAt: Date;
  source: 'crm' | 'brokerage_transfer';
  notes?: string;
  closerId: string;
  contractHolder: FinalizeContractHolder;
  operadora: string;
  productName?: string;
  contractFile?: File;
  dependents: FinalizeContractDependent[];
}

interface FinalizeContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadCloserId?: string;
  initialHolderCnpj?: string | null;
  onFinalize: (data: FinalizeContractData) => Promise<void>;
  closers?: UserAssociated[];
  healthPlans?: { id: string; name: string }[];
  initialAmount?: number | null;
  initialStartDate?: string | Date | null;
  initialOperadora?: string | null;
}

export function FinalizeContractDialog({
  open,
  onOpenChange,
  leadName,
  leadCloserId,
  initialHolderCnpj,
  onFinalize,
  closers = [],
  healthPlans = [],
  initialAmount,
  initialStartDate,
  initialOperadora,
}: FinalizeContractDialogProps) {
  const { tz } = useTimezone();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount]           = useState('');
  const [closerId, setCloserId]       = useState('');
  const [operadora, setOperadora]     = useState('');
  const [productName, setProductName] = useState('');
  const [source, setSource] = useState<'crm' | 'brokerage_transfer'>('crm');
  const [holderName, setHolderName] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState<Date | undefined>();
  const [holderDocument, setHolderDocument] = useState('');
  const [holderCnpj, setHolderCnpj] = useState('');
  const [startDate, setStartDate]     = useState<Date | undefined>(() => new Date());
  const [finalizedDate, setFinalizedDate] = useState<Date | undefined>();
  const [contractFile, setContractFile]   = useState<File | undefined>();
  const [notes, setNotes]             = useState('');
  const [dependents, setDependents]   = useState<FinalizeContractDependent[]>([]);
  const [showAddDependent, setShowAddDependent] = useState(false);
  const [editingDependent, setEditingDependent] = useState<FinalizeContractDependent | undefined>();
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [amountError, setAmountError] = useState('');

  const toDisplayCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseInitialDate = (value: string | Date | null | undefined): Date | undefined => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
  };

  useEffect(() => {
    if (open) {
      setAmount(toDisplayCurrency(initialAmount));
      setCloserId(leadCloserId ?? '');
      setOperadora(initialOperadora ?? '');
      setProductName('');
      setSource('crm');
      setHolderName('');
      setHolderBirthDate(undefined);
      setHolderDocument('');
      setHolderCnpj(sanitizeDocumentDigits(initialHolderCnpj ?? ''));
      setStartDate(parseInitialDate(initialStartDate) ?? new Date());
      setFinalizedDate(undefined);
      setContractFile(undefined);
      setNotes('');
      setDependents([]);
      setError('');
      setAmountError('');
    }
  }, [open, leadCloserId, initialAmount, initialOperadora, initialStartDate, initialHolderCnpj]);

  const formatCurrencyDisplay = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const numberValue = parseInt(numbers) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseFormattedValue = (formattedValue: string): number => {
    const numbers = formattedValue.replace(/\D/g, '');
    return parseInt(numbers || '0') / 100;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyDisplay(e.target.value);
    const numericValue = parseFormattedValue(formatted);
    if (numericValue > MAX_CURRENCY_VALUE) {
      setAmountError(`O valor deve ser menor que ${MAX_CURRENCY_LABEL}`);
      setAmount(formatted);
      return;
    }
    if (formatted && numericValue === 0) {
      setAmountError('O valor do contrato deve ser maior que R$ 0,00');
      setAmount(formatted);
      return;
    }
    setAmountError('');
    setAmount(formatted);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('O arquivo deve ter no máximo 10MB.');
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Formato não permitido. Use PDF, imagem ou Word.');
      return;
    }
    setContractFile(file);
  };

  const handleSaveDependent = (dep: FinalizeContractDependent) => {
    setDependents((prev) => {
      const idx = prev.findIndex((d) => d.id === dep.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = dep;
        return next;
      }
      return [...prev, dep];
    });
    setEditingDependent(undefined);
  };

  const handleEditDependent = (dep: FinalizeContractDependent) => {
    setEditingDependent(dep);
    setShowAddDependent(true);
  };

  const handleRemoveDependent = (id: string) => {
    setDependents((prev) => prev.filter((d) => d.id !== id));
  };

  const isFormValid =
    parseFormattedValue(amount) > 0 &&
    !amountError &&
    !!closerId &&
    !!operadora &&
    holderName.trim().length > 0 &&
    !!holderBirthDate &&
    sanitizeRgCpfDigits(holderDocument).length > 0 &&
    !!startDate &&
    !!finalizedDate &&
    finalizedDate >= startDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isFormValid || !startDate || !finalizedDate || !holderBirthDate) return;

    const loadingToast = toast.loading('Finalizando contrato...');
    setIsLoading(true);
    onOpenChange(false);

    try {
      await onFinalize({
        amount: parseFormattedValue(amount),
        startDateAt: startOfDayInTz(startDate, tz),
        finalizedDateAt: startOfDayInTz(finalizedDate, tz),
        source,
        notes: notes.trim() || undefined,
        closerId,
        contractHolder: {
          name: holderName.trim(),
          birthDate: holderBirthDate,
          document: sanitizeRgCpfDigits(holderDocument),
          cnpj: sanitizeDocumentDigits(holderCnpj) || undefined,
        },
        operadora,
        productName: productName.trim() || undefined,
        contractFile,
        dependents,
      });

      toast.success(
        `Contrato finalizado! Valor: R$ ${parseFormattedValue(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        { id: loadingToast, duration: 5000 }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao finalizar contrato';
      toast.error(msg, { id: loadingToast, duration: 5000 });
      setError(msg);
      onOpenChange(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const PARENTESCO_LABELS: Record<string, string> = {
    pai: 'Pai', mae: 'Mãe', filho: 'Filho(a)', conjuge: 'Cônjuge',
    sobrinho: 'Sobrinho(a)', neto: 'Neto(a)', avo: 'Avô/Avó', tio: 'Tio(a)', irmao: 'Irmão/Irmã',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle>Fechar Contrato</DialogTitle>
            <DialogDescription>
              Preencha os detalhes do contrato para o lead: <strong>{leadName}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <p className="text-sm font-semibold">Dados do contrato</p>
                  <Separator />
                </div>

                {/* Valor do Contrato */}
                <div className="grid gap-2">
                  <Label>Origem do cliente *</Label>
                  <RadioGroup value={source} onValueChange={(value) => setSource(value as 'crm' | 'brokerage_transfer')} className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="contract-source-crm" value="crm" />
                      <Label htmlFor="contract-source-crm">CRM</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="contract-source-transfer" value="brokerage_transfer" />
                      <Label htmlFor="contract-source-transfer">Transferência de corretagem</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="amount">Valor do Contrato (R$) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      id="amount"
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={amount}
                      onChange={handleAmountChange}
                      disabled={isLoading}
                      className={cn('pl-10', amountError && 'border-destructive focus-visible:ring-destructive')}
                    />
                  </div>
                  {amountError && <p className="text-[12px] text-destructive">{amountError}</p>}
                </div>

                {/* Closer */}
                <div className="grid gap-2">
                  <Label>Closer responsável *</Label>
                  <Select value={closerId} onValueChange={setCloserId} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o closer" />
                    </SelectTrigger>
                    <SelectContent>
                      {closers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operadora */}
                <div className="grid gap-2">
                  <Label>Operadora *</Label>
                  <Select value={operadora} onValueChange={setOperadora} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a operadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {healthPlans.map((hp) => (
                        <SelectItem key={hp.id} value={hp.name}>{hp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Nome do Produto */}
                <div className="grid gap-2">
                  <Label htmlFor="productName">Nome do Produto</Label>
                  <Input
                    id="productName"
                    placeholder="Ex: Plano Empresarial Plus"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                {/* Data de Início */}
                <div className="grid gap-2">
                  <Label>Data de Início do Contrato *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        required={false}
                        selected={startDate}
                        onSelect={setStartDate}
                        weekdayLabelFormat="short"
                        locale={ptBR}
                        captionLayout="dropdown"
                        fromYear={2020}
                        toYear={new Date().getFullYear() + 5}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Data de Finalização */}
                <div className="grid gap-2">
                  <Label>Data de Finalização do Contrato *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('justify-start text-left font-normal', !finalizedDate && 'text-muted-foreground')}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {finalizedDate ? format(finalizedDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        required={false}
                        selected={finalizedDate}
                        onSelect={setFinalizedDate}
                        weekdayLabelFormat="short"
                        locale={ptBR}
                        captionLayout="dropdown"
                        fromYear={2020}
                        toYear={new Date().getFullYear() + 5}
                        initialFocus
                        disabled={(date: Date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Upload do Contrato */}
                <div className="grid gap-2">
                  <Label>Contrato (opcional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    aria-label="Anexar contrato"
                    title="Anexar contrato"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={handleFileChange}
                  />
                  {contractFile ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{contractFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-destructive hover:text-destructive"
                        onClick={() => { setContractFile(undefined); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start gap-2 text-muted-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <UploadCloud size={14} />
                      Anexar contrato (PDF, imagem ou Word — max 10MB)
                    </Button>
                  )}
                </div>

                {/* Observações */}
                <div className="grid gap-2">
                  <Label htmlFor="notes">Observações (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Adicione observações sobre o contrato..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isLoading}
                    rows={2}
                  />
                </div>

                <div className="grid gap-2 pt-1">
                  <p className="text-sm font-semibold">Dados do titular</p>
                  <Separator />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="holder-name">Nome do Titular *</Label>
                  <Input
                    id="holder-name"
                    placeholder="Nome completo do titular"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Data de Nascimento do Titular *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('justify-start text-left font-normal', !holderBirthDate && 'text-muted-foreground')}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {holderBirthDate ? format(holderBirthDate, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        required={false}
                        selected={holderBirthDate}
                        onSelect={setHolderBirthDate}
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
                  <Label htmlFor="holder-document">Documento (RG/CPF) *</Label>
                  <Input
                    id="holder-document"
                    placeholder="CPF ou RG"
                    value={formatRgCpfInput(holderDocument)}
                    onChange={(e) => setHolderDocument(sanitizeRgCpfDigits(e.target.value))}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="holder-cnpj">CNPJ</Label>
                  <Input
                    id="holder-cnpj"
                    placeholder="00.000.000/0000-00"
                    value={formatDocumentInput(holderCnpj)}
                    onChange={(e) => setHolderCnpj(sanitizeDocumentDigits(e.target.value))}
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2 pt-1">
                  <p className="text-sm font-semibold">Dados de dependentes</p>
                  <Separator />
                </div>

                {/* Dependentes */}
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label>Dependentes</Label>
                    <span className="text-[11px] text-muted-foreground">{dependents.length} adicionado(s)</span>
                  </div>

                  {dependents.length > 0 && (
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {dependents.map((dep) => (
                        <div key={dep.id} className="flex items-center gap-3 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate">{dep.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {PARENTESCO_LABELS[dep.parentesco] ?? dep.parentesco}
                              {' · '}
                              {format(dep.birthDate, 'dd/MM/yyyy')}
                              {dep.document ? ` · ${formatRgCpfInput(dep.document)}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => handleEditDependent(dep)}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveDependent(dep.id)}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 self-start"
                    onClick={() => { setEditingDependent(undefined); setShowAddDependent(true); }}
                    disabled={isLoading}
                  >
                    <Plus size={13} />
                    Adicionar dependente
                  </Button>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
                )}
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !isFormValid}>
                {isLoading ? 'Finalizando...' : 'Fechar Contrato'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddDependentModal
        open={showAddDependent}
        onOpenChange={(o) => { setShowAddDependent(o); if (!o) setEditingDependent(undefined); }}
        onSave={handleSaveDependent}
        initialData={editingDependent}
      />
    </>
  );
}
