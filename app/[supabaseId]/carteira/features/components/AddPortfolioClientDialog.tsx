"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTeamContext } from '@/app/context/TeamContext';
import { useTeamClosers } from '@/hooks/useTeamMembersByFunction';
import { useHealthPlans } from '@/hooks/useHealthPlans';
import { formatDocumentInput, isValidPhone, maskPhone, normalizeLeadPhoneDigits, sanitizeDocumentDigits } from '@/lib/masks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FinalizeContractDialog,
  type FinalizeContractData,
} from '@/app/[supabaseId]/board/features/container/FinalizeContractDialog';
import type {
  CreateCarteiraIdentityStepPayload,
  CreatePortfolioFromStepsPayload,
} from '../context/CarteiraTypes';
import { useCarteiraContext } from '../context/CarteiraContext';

interface AddPortfolioClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FlowStep = 'identity' | 'contract';

const emptyIdentity: CreateCarteiraIdentityStepPayload = {
  name: '',
  email: '',
  phone: '',
  cnpj: '',
  source: 'manual',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddPortfolioClientDialog({ open, onOpenChange }: AddPortfolioClientDialogProps) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { createEntry } = useCarteiraContext();
  const { members: closers } = useTeamClosers(supabaseId, activeTeamId);
  const { healthPlans } = useHealthPlans(supabaseId, activeTeamId);

  const [step, setStep] = useState<FlowStep>('identity');
  const [identity, setIdentity] = useState<CreateCarteiraIdentityStepPayload>(emptyIdentity);

  useEffect(() => {
    if (!open) {
      setStep('identity');
      setIdentity(emptyIdentity);
    }
  }, [open]);

  const isIdentityValid = useMemo(() => {
    const hasName = identity.name.trim().length > 0;
    const hasEmail = identity.email.trim().length > 0 && EMAIL_REGEX.test(identity.email.trim());
    const hasPhone = identity.phone.trim().length > 0 && isValidPhone(identity.phone);
    return hasName && hasEmail && hasPhone;
  }, [identity.email, identity.name, identity.phone]);

  const isIdentityOpen = open && step === 'identity';
  const isContractOpen = open && step === 'contract';

  const closeFlow = () => {
    onOpenChange(false);
  };

  const handleFinalizeContract = async (data: FinalizeContractData) => {
    const composed: CreatePortfolioFromStepsPayload = {
      identity,
      contract: {
        amount: data.amount,
        startDateAt: data.startDateAt.toISOString(),
        finalizedDateAt: data.finalizedDateAt.toISOString(),
        contractDueDate: undefined,
        closerId: data.closerId,
        operadora: data.operadora,
        productName: data.productName ?? null,
        soldPlan: null,
        notes: data.notes ?? null,
        holder: {
          name: data.contractHolder.name,
          birthDate: data.contractHolder.birthDate.toISOString(),
          document: data.contractHolder.document,
          cnpj: data.contractHolder.cnpj ?? null,
        },
        dependents: data.dependents.map((dependent) => ({
          name: dependent.name,
          birthDate: dependent.birthDate.toISOString(),
          parentesco: dependent.parentesco,
          document: dependent.document ?? null,
        })),
      },
    };

    try {
      await createEntry({
        name: composed.identity.name.trim(),
        email: composed.identity.email.trim(),
        phone: normalizeLeadPhoneDigits(composed.identity.phone),
        cnpj: sanitizeDocumentDigits(composed.identity.cnpj || '') || undefined,
        source: composed.identity.source,
        amount: composed.contract.amount,
        startDateAt: composed.contract.startDateAt,
        finalizedDateAt: composed.contract.finalizedDateAt,
        contractDueDate: composed.contract.contractDueDate,
        closerId: composed.contract.closerId,
        operadora: composed.contract.operadora,
        productName: composed.contract.productName ?? undefined,
        soldPlan: composed.contract.soldPlan ?? undefined,
        notes: composed.contract.notes ?? undefined,
        holder: {
          name: composed.contract.holder.name,
          birthDate: composed.contract.holder.birthDate,
          document: composed.contract.holder.document,
          cnpj: composed.contract.holder.cnpj ?? undefined,
        },
        dependents: composed.contract.dependents,
      });

      closeFlow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar cliente');
      throw error;
    }
  };

  return (
    <>
      <Dialog open={isIdentityOpen} onOpenChange={closeFlow}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Adicionar cliente na carteira</DialogTitle>
            <DialogDescription>
              Informe os dados do cliente para seguir ao fechamento do contrato.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Origem do cliente *</Label>
              <RadioGroup
                value={identity.source}
                onValueChange={(value) =>
                  setIdentity((prev) => ({
                    ...prev,
                    source: value as 'manual' | 'brokerage_transfer',
                  }))
                }
                className="grid gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="portfolio-source-manual" value="manual" />
                  <Label htmlFor="portfolio-source-manual">Manual</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="portfolio-source-transfer" value="brokerage_transfer" />
                  <Label htmlFor="portfolio-source-transfer">Transferência de corretagem</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="portfolio-client-name">Nome *</Label>
              <Input
                id="portfolio-client-name"
                value={identity.name}
                onChange={(event) =>
                  setIdentity((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="portfolio-client-email">E-mail *</Label>
                <Input
                  id="portfolio-client-email"
                  type="email"
                  value={identity.email}
                  onChange={(event) =>
                    setIdentity((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="portfolio-client-phone">Telefone *</Label>
                <Input
                  id="portfolio-client-phone"
                  value={identity.phone}
                  onChange={(event) =>
                    setIdentity((prev) => ({ ...prev, phone: maskPhone(event.target.value) }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="portfolio-client-cnpj">CNPJ do cliente</Label>
              <Input
                id="portfolio-client-cnpj"
                value={identity.cnpj ?? ''}
                onChange={(event) =>
                  setIdentity((prev) => ({ ...prev, cnpj: formatDocumentInput(event.target.value) }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeFlow}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!isIdentityValid}
              onClick={() => setStep('contract')}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FinalizeContractDialog
        open={isContractOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setStep('identity');
            closeFlow();
          }
        }}
        onBackStep={() => setStep('identity')}
        headerTitle="Adicionar cliente na carteira"
        headerDescription={`Preencha os detalhes do contrato para o cliente: ${identity.name || 'Cliente'}`}
        leadName={identity.name || 'Cliente'}
        onFinalize={handleFinalizeContract}
        closers={closers}
        healthPlans={healthPlans}
        initialHolderCnpj={identity.cnpj || null}
      />
    </>
  );
}
