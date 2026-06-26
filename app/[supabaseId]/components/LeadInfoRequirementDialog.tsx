'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgeEntryInput, type AgeEntryInputHandle } from "@/components/ui/age-entry-input";
import type { LeadTransitionFieldApiKey } from "@/lib/leadStatusTransitionFields";

export type MissingLeadField = LeadTransitionFieldApiKey;

export interface LeadInfoPayload {
  age?: string;
  currentHealthPlan?: string;
  referenceHospital?: string;
  ongoingTreatment?: string;
  email?: string;
  phone?: string;
  cnpj?: string;
}

export interface LeadInfoInitialValues {
  age: string | null;
  currentHealthPlan: string | null;
  referenceHospital: string | null;
  ongoingTreatment: string | null;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
}

interface LeadInfoRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: LeadInfoPayload) => Promise<void>;
  initialValues?: LeadInfoInitialValues;
  missingFields?: MissingLeadField[];
  isSaving?: boolean;
  leadName?: string;
}

export function LeadInfoRequirementDialog({
  open,
  onOpenChange,
  onSave,
  initialValues,
  missingFields = [],
  isSaving = false,
  leadName,
}: LeadInfoRequirementDialogProps) {
  const ageInputRef = useRef<AgeEntryInputHandle>(null);
  const [age, setAge] = useState("");
  const [currentHealthPlan, setCurrentHealthPlan] = useState("");
  const [referenceHospital, setReferenceHospital] = useState("");
  const [ongoingTreatment, setOngoingTreatment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState("");

  useEffect(() => {
    if (!open) return;
    setAge(initialValues?.age ?? "");
    setCurrentHealthPlan(initialValues?.currentHealthPlan ?? "");
    setReferenceHospital(initialValues?.referenceHospital ?? "");
    setOngoingTreatment(initialValues?.ongoingTreatment ?? "");
    setEmail(initialValues?.email ?? "");
    setPhone(initialValues?.phone ?? "");
    setCnpj(initialValues?.cnpj ?? "");
  }, [open, initialValues]);

  const missing = useMemo(() => new Set(missingFields), [missingFields]);

  const handleSubmit = async () => {
    const flushedAge = ageInputRef.current?.flush() ?? age;
    await onSave({
      ...(missing.has("age") ? { age: flushedAge } : {}),
      ...(missing.has("currentHealthPlan") ? { currentHealthPlan } : {}),
      ...(missing.has("referenceHospital") ? { referenceHospital } : {}),
      ...(missing.has("ongoingTreatment") ? { ongoingTreatment } : {}),
      ...(missing.has("email") ? { email } : {}),
      ...(missing.has("phone") ? { phone } : {}),
      ...(missing.has("cnpj") ? { cnpj } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Informações obrigatórias do lead</DialogTitle>
          <DialogDescription>
            {leadName
              ? `Preencha os dados pendentes para continuar a movimentação do lead ${leadName}.`
              : "Preencha os dados pendentes para continuar a movimentação do lead."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-4">
            {missing.has("age") && (
              <div className="grid gap-2">
                <Label>Idades dos Beneficiários *</Label>
                <AgeEntryInput ref={ageInputRef} value={age} onChange={setAge} disabled={isSaving} />
              </div>
            )}

            {missing.has("currentHealthPlan") && (
              <div className="grid gap-2">
                <Label htmlFor="lead-info-current-plan">Plano atual *</Label>
                <Input
                  id="lead-info-current-plan"
                  value={currentHealthPlan}
                  onChange={(event) => setCurrentHealthPlan(event.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}

            {missing.has("referenceHospital") && (
              <div className="grid gap-2">
                <Label htmlFor="lead-info-reference-hospital">Hospital de referência *</Label>
                <Input
                  id="lead-info-reference-hospital"
                  value={referenceHospital}
                  onChange={(event) => setReferenceHospital(event.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}

            {missing.has("ongoingTreatment") && (
              <div className="grid gap-2">
                <Label htmlFor="lead-info-ongoing-treatment">Tratamento em andamento *</Label>
                <Textarea
                  id="lead-info-ongoing-treatment"
                  value={ongoingTreatment}
                  onChange={(event) => setOngoingTreatment(event.target.value)}
                  rows={3}
                  disabled={isSaving}
                />
              </div>
            )}

            {missing.has("email") && (
              <div className="grid gap-2">
                <Label htmlFor="lead-info-email">E-mail *</Label>
                <Input
                  id="lead-info-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}

            {missing.has("phone") && (
              <div className="grid gap-2">
                <Label htmlFor="lead-info-phone">Telefone *</Label>
                <Input
                  id="lead-info-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}

            {missing.has("cnpj") && (
              <div className="grid gap-2">
                <Label htmlFor="lead-info-cnpj">CNPJ *</Label>
                <Input
                  id="lead-info-cnpj"
                  value={cnpj}
                  onChange={(event) => setCnpj(event.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
