"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  formatDocumentInput,
  formatRgCpfInput,
  isValidPhone,
  maskPhone,
  normalizeLeadPhoneDigits,
  sanitizeDocumentDigits,
  sanitizeRgCpfDigits,
} from '@/lib/masks';
import { useTeamContext } from '@/app/context/TeamContext';
import { useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { useHealthPlans } from '@/hooks/useHealthPlans';
import type { CreateCarteiraIdentityStepPayload } from '../context/CarteiraTypes';
import { useCarteiraContext } from '../context/CarteiraContext';

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FlowStep = 'identity' | 'contract';
type StepState = 'active' | 'done' | 'pending';

function parseCurrencyInput(value: string): number {
  const clean = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function StepItem({ index, label, state }: { index: number; label: string; state: StepState }) {
  return (
    <div
      className={cn(
        'flex-1 pb-3 text-center text-sm font-semibold border-b-2',
        state === 'active'  && 'border-primary text-primary',
        state === 'done'    && 'border-[var(--semantic-success)] text-[var(--semantic-success)]',
        state === 'pending' && 'border-transparent text-muted-foreground',
      )}
    >
      {state === 'done' ? '✓ ' : ''}{index} · {label}
    </div>
  );
}

interface DependentEntry {
  _key: string;
  name: string;
  birthDate: Date | undefined;
  parentesco: string;
  document: string;
}

interface AddDependentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (dep: Omit<DependentEntry, '_key'>) => void;
}

function AddDependentDialog({ open, onOpenChange, onAdd }: AddDependentDialogProps) {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [parentesco, setParentesco] = useState('');
  const [document, setDocument] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setBirthDate(undefined);
      setParentesco('');
      setDocument('');
    }
  }, [open]);

  const isValid = !!name.trim() && !!birthDate && !!parentesco;

  const handleAdd = () => {
    if (!isValid) return;
    onAdd({ name: name.trim(), birthDate, parentesco, document });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle>Adicionar dependente</DialogTitle>
        <DialogDescription className="sr-only">Preencha os dados do dependente</DialogDescription>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <DateTimePicker
            date={birthDate}
            onDateChange={setBirthDate}
            label="Data de Nascimento *"
            showTime={false}
            disablePastDates={false}
          />
          <div className="flex flex-col gap-1.5">
            <Label>Parentesco *</Label>
            <Select value={parentesco} onValueChange={setParentesco}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {PARENTESCO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Documento (CPF/RG)</Label>
            <Input
              value={formatRgCpfInput(document)}
              onChange={(e) => setDocument(sanitizeRgCpfDigits(e.target.value))}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!isValid} onClick={handleAdd}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const emptyIdentity: CreateCarteiraIdentityStepPayload = {
  name: '',
  email: '',
  phone: '',
  cnpj: '',
  source: 'manual',
};

interface ContractForm {
  amount: string;
  startDateAt: Date | undefined;
  finalizedDateAt: Date | undefined;
  closerId: string;
  operadora: string;
  productName: string;
  notes: string;
  holderName: string;
  holderBirthDate: Date | undefined;
  holderDocument: string;
  holderCnpj: string;
  dependents: DependentEntry[];
}

const emptyContract: ContractForm = {
  amount: '',
  startDateAt: undefined,
  finalizedDateAt: undefined,
  closerId: '',
  operadora: '',
  productName: '',
  notes: '',
  holderName: '',
  holderBirthDate: undefined,
  holderDocument: '',
  holderCnpj: '',
  dependents: [],
};

interface AddPortfolioClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPortfolioClientDialog({ open, onOpenChange }: AddPortfolioClientDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { createEntry } = useCarteiraContext();
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);
  const { healthPlans } = useHealthPlans(supabaseId, activeTeamId);

  const [step, setStep] = useState<FlowStep>('identity');
  const [identity, setIdentity] = useState<CreateCarteiraIdentityStepPayload>(emptyIdentity);
  const [contract, setContract] = useState<ContractForm>(emptyContract);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDependentOpen, setIsDependentOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('identity');
      setIdentity(emptyIdentity);
      setContract(emptyContract);
      setIsSubmitting(false);
    }
  }, [open]);

  const closeFlow = () => onOpenChange(false);

  const isIdentityValid = useMemo(() => {
    const hasName  = identity.name.trim().length > 0;
    const hasEmail = identity.email.trim().length > 0 && EMAIL_REGEX.test(identity.email.trim());
    const hasPhone = identity.phone.trim().length > 0 && isValidPhone(identity.phone);
    return hasName && hasEmail && hasPhone;
  }, [identity.email, identity.name, identity.phone]);

  const isContractValid = useMemo(() => {
    const amount = parseCurrencyInput(contract.amount);
    return (
      amount > 0 &&
      !!contract.closerId &&
      !!contract.operadora &&
      !!contract.startDateAt &&
      !!contract.finalizedDateAt &&
      !!contract.holderName.trim() &&
      !!contract.holderBirthDate
    );
  }, [contract]);

  const patch = <K extends keyof ContractForm>(key: K, value: ContractForm[K]) => {
    setContract((prev) => ({ ...prev, [key]: value }));
  };

  const addDependent = (dep: Omit<DependentEntry, '_key'>) => {
    setContract((prev) => ({
      ...prev,
      dependents: [...prev.dependents, { ...dep, _key: crypto.randomUUID() }],
    }));
  };

  const removeDependent = (key: string) => {
    setContract((prev) => ({
      ...prev,
      dependents: prev.dependents.filter((d) => d._key !== key),
    }));
  };

  const handleSubmit = async () => {
    if (!isContractValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createEntry({
        name: identity.name.trim(),
        email: identity.email.trim(),
        phone: normalizeLeadPhoneDigits(identity.phone),
        cnpj: sanitizeDocumentDigits(identity.cnpj || '') || undefined,
        source: identity.source,
        amount: parseCurrencyInput(contract.amount),
        startDateAt: contract.startDateAt!.toISOString(),
        finalizedDateAt: contract.finalizedDateAt!.toISOString(),
        contractDueDate: undefined,
        closerId: contract.closerId,
        operadora: contract.operadora,
        productName: contract.productName.trim() || undefined,
        soldPlan: undefined,
        notes: contract.notes.trim() || undefined,
        holder: {
          name: contract.holderName.trim(),
          birthDate: contract.holderBirthDate!.toISOString(),
          document: sanitizeRgCpfDigits(contract.holderDocument),
          cnpj: contract.holderCnpj.trim() || undefined,
        },
        dependents: contract.dependents.map((d) => ({
          name: d.name,
          birthDate: d.birthDate!.toISOString(),
          parentesco: d.parentesco,
          document: d.document ? sanitizeRgCpfDigits(d.document) : null,
        })),
      });
      closeFlow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeFlow}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
          <DialogTitle className="sr-only">Adicionar cliente na carteira</DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os dados do cliente e do contrato em duas etapas.
          </DialogDescription>

          {/* Step bar */}
          <div className="flex -mx-6 border-b px-6 pb-0">
            <StepItem
              index={1}
              label="Dados do cliente"
              state={step === 'identity' ? 'active' : 'done'}
            />
            <StepItem
              index={2}
              label="Contrato e titular"
              state={step === 'contract' ? 'active' : 'pending'}
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto py-4">
            {step === 'identity' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Origem do cliente *</Label>
                  <RadioGroup
                    value={identity.source}
                    onValueChange={(value) =>
                      setIdentity((prev) => ({ ...prev, source: value as 'manual' | 'brokerage_transfer' }))
                    }
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="add-source-manual" value="manual" />
                      <Label htmlFor="add-source-manual">Manual</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem id="add-source-transfer" value="brokerage_transfer" />
                      <Label htmlFor="add-source-transfer">Transferência de corretagem</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-name">Nome *</Label>
                  <Input
                    id="add-name"
                    value={identity.name}
                    onChange={(e) => setIdentity((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-email">E-mail *</Label>
                    <Input
                      id="add-email"
                      type="email"
                      value={identity.email}
                      onChange={(e) => setIdentity((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-phone">Telefone *</Label>
                    <Input
                      id="add-phone"
                      value={identity.phone}
                      onChange={(e) => setIdentity((prev) => ({ ...prev, phone: maskPhone(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-cnpj">CNPJ do cliente</Label>
                  <Input
                    id="add-cnpj"
                    value={identity.cnpj ?? ''}
                    onChange={(e) => setIdentity((prev) => ({ ...prev, cnpj: formatDocumentInput(e.target.value) }))}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Contrato */}
                <section className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contrato</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Valor (R$) *</Label>
                      <Input
                        value={contract.amount}
                        onChange={(e) => patch('amount', e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Closer *</Label>
                      <Select value={contract.closerId} onValueChange={(v) => patch('closerId', v)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {(closers ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Operadora *</Label>
                      <Select value={contract.operadora} onValueChange={(v) => patch('operadora', v)}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {(healthPlans ?? []).map((hp) => (
                            <SelectItem key={hp.id ?? hp.name} value={hp.name}>{hp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Produto</Label>
                      <Input
                        value={contract.productName}
                        onChange={(e) => patch('productName', e.target.value)}
                        placeholder="Nome do plano"
                      />
                    </div>
                    <DateTimePicker
                      date={contract.startDateAt}
                      onDateChange={(d) => patch('startDateAt', d)}
                      label="Data de início *"
                      showTime={false}
                      disablePastDates={false}
                    />
                    <DateTimePicker
                      date={contract.finalizedDateAt}
                      onDateChange={(d) => patch('finalizedDateAt', d)}
                      label="Data de finalização *"
                      showTime={false}
                      disablePastDates={false}
                    />
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label>Observações</Label>
                      <Textarea
                        value={contract.notes}
                        onChange={(e) => patch('notes', e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Titular */}
                <section className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titular</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label>Nome completo *</Label>
                      <Input
                        value={contract.holderName}
                        onChange={(e) => patch('holderName', e.target.value)}
                      />
                    </div>
                    <DateTimePicker
                      date={contract.holderBirthDate}
                      onDateChange={(d) => patch('holderBirthDate', d)}
                      label="Data de nascimento *"
                      showTime={false}
                      disablePastDates={false}
                    />
                    <div className="flex flex-col gap-1.5">
                      <Label>CPF</Label>
                      <Input
                        value={formatRgCpfInput(contract.holderDocument)}
                        onChange={(e) => patch('holderDocument', sanitizeRgCpfDigits(e.target.value))}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1.5">
                      <Label>CNPJ (opcional)</Label>
                      <Input
                        value={contract.holderCnpj}
                        onChange={(e) => patch('holderCnpj', e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Dependentes */}
                <section className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dependentes</p>
                  {contract.dependents.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {contract.dependents.map((dep) => (
                        <div key={dep._key} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-medium">{dep.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{dep.parentesco}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => removeDependent(dep._key)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                    onClick={() => setIsDependentOpen(true)}
                  >
                    <Plus className="size-4" />
                    Adicionar dependente
                  </button>
                </section>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="shrink-0 border-t pt-4">
            {step === 'identity' ? (
              <>
                <Button variant="outline" type="button" onClick={closeFlow}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!isIdentityValid}
                  onClick={() => setStep('contract')}
                >
                  Próximo
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" type="button" onClick={() => setStep('identity')}>
                  Voltar
                </Button>
                <Button
                  type="button"
                  disabled={!isContractValid || isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? 'Salvando...' : 'Fechar Contrato'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddDependentDialog
        open={isDependentOpen}
        onOpenChange={setIsDependentOpen}
        onAdd={addDependent}
      />
    </>
  );
}
