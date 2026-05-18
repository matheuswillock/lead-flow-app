"use client";

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTeamContext } from '@/app/context/TeamContext';
import { useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateCarteiraPayload } from '../context/CarteiraTypes';
import { useCarteiraContext } from '../context/CarteiraContext';

interface AddPortfolioClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function asIsoStartOfDay(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

export function AddPortfolioClientDialog({ open, onOpenChange }: AddPortfolioClientDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { createEntry } = useCarteiraContext();
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);

  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [source, setSource] = useState<'manual' | 'brokerage_transfer'>('manual');
  const [amount, setAmount] = useState('');
  const [startDateAt, setStartDateAt] = useState('');
  const [finalizedDateAt, setFinalizedDateAt] = useState('');
  const [contractDueDate, setContractDueDate] = useState('');
  const [closerId, setCloserId] = useState('');
  const [operadora, setOperadora] = useState('');
  const [productName, setProductName] = useState('');
  const [soldPlan, setSoldPlan] = useState('');
  const [notes, setNotes] = useState('');
  const [holderName, setHolderName] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [holderDocument, setHolderDocument] = useState('');
  const [holderCnpj, setHolderCnpj] = useState('');

  const canSubmit = useMemo(() => {
    const numericAmount = Number(amount.replace(',', '.'));
    return (
      name.trim().length > 0 &&
      Number.isFinite(numericAmount) &&
      numericAmount > 0 &&
      startDateAt &&
      finalizedDateAt &&
      closerId &&
      operadora.trim().length > 0 &&
      holderName.trim().length > 0 &&
      holderBirthDate &&
      holderDocument.trim().length > 0
    );
  }, [amount, closerId, finalizedDateAt, holderBirthDate, holderDocument, holderName, name, operadora, startDateAt]);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCnpj('');
    setSource('manual');
    setAmount('');
    setStartDateAt('');
    setFinalizedDateAt('');
    setContractDueDate('');
    setCloserId('');
    setOperadora('');
    setProductName('');
    setSoldPlan('');
    setNotes('');
    setHolderName('');
    setHolderBirthDate('');
    setHolderDocument('');
    setHolderCnpj('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    const numericAmount = Number(amount.replace(',', '.'));
    const payload: CreateCarteiraPayload = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      cnpj: cnpj.trim() || undefined,
      source,
      amount: numericAmount,
      startDateAt: asIsoStartOfDay(startDateAt),
      finalizedDateAt: asIsoStartOfDay(finalizedDateAt),
      contractDueDate: contractDueDate ? asIsoStartOfDay(contractDueDate) : undefined,
      closerId,
      operadora: operadora.trim(),
      productName: productName.trim() || undefined,
      soldPlan: soldPlan.trim() || undefined,
      notes: notes.trim() || undefined,
      holder: {
        name: holderName.trim(),
        birthDate: asIsoStartOfDay(holderBirthDate),
        document: holderDocument.trim(),
        cnpj: holderCnpj.trim() || undefined,
      },
      dependents: [],
    };

    setIsSaving(true);
    try {
      await createEntry(payload);
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar cliente na carteira</DialogTitle>
          <DialogDescription>
            Cadastre um cliente já fechado com origem Manual ou Transferência de corretagem.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label>Origem do cliente *</Label>
            <RadioGroup value={source} onValueChange={(value) => setSource(value as 'manual' | 'brokerage_transfer')} className="grid gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="portfolio-source-manual" />
                <Label htmlFor="portfolio-source-manual">Manual</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="brokerage_transfer" id="portfolio-source-transfer" />
                <Label htmlFor="portfolio-source-transfer">Transferência de corretagem</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="portfolio-name">Nome *</Label>
              <Input id="portfolio-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-email">Email</Label>
              <Input id="portfolio-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-phone">Telefone</Label>
              <Input id="portfolio-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-cnpj">CNPJ do cliente</Label>
              <Input id="portfolio-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="portfolio-amount">Valor do contrato (R$) *</Label>
              <Input id="portfolio-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Closer *</Label>
              <Select value={closerId} onValueChange={setCloserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o closer" />
                </SelectTrigger>
                <SelectContent>
                  {closers.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-startDate">Data de início *</Label>
              <Input id="portfolio-startDate" type="date" value={startDateAt} onChange={(e) => setStartDateAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-finalizedDate">Data de finalização *</Label>
              <Input id="portfolio-finalizedDate" type="date" value={finalizedDateAt} onChange={(e) => setFinalizedDateAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-dueDate">Data de vigência</Label>
              <Input id="portfolio-dueDate" type="date" value={contractDueDate} onChange={(e) => setContractDueDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-operadora">Operadora *</Label>
              <Input id="portfolio-operadora" value={operadora} onChange={(e) => setOperadora(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-productName">Produto</Label>
              <Input id="portfolio-productName" value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-soldPlan">Plano vendido</Label>
              <Input id="portfolio-soldPlan" value={soldPlan} onChange={(e) => setSoldPlan(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="portfolio-holder-name">Titular - Nome *</Label>
              <Input id="portfolio-holder-name" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-holder-birthDate">Titular - Nascimento *</Label>
              <Input id="portfolio-holder-birthDate" type="date" value={holderBirthDate} onChange={(e) => setHolderBirthDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-holder-document">Titular - Documento *</Label>
              <Input id="portfolio-holder-document" value={holderDocument} onChange={(e) => setHolderDocument(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio-holder-cnpj">Titular - CNPJ</Label>
              <Input id="portfolio-holder-cnpj" value={holderCnpj} onChange={(e) => setHolderCnpj(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="portfolio-notes">Observações</Label>
            <Textarea id="portfolio-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving ? 'Salvando...' : 'Adicionar cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

