'use client';

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AgeRangeInput } from "@/components/ui/age-range-input";

export type MissingLeadField = "age" | "currentHealthPlan" | "referenceHospital" | "ongoingTreatment";

export interface LeadInfoPayload {
  age?: string;
  currentHealthPlan?: string;
  referenceHospital?: string;
  ongoingTreatment?: string;
}

export interface LeadInfoInitialValues {
  age: string | null;
  currentHealthPlan: string | null;
  referenceHospital: string | null;
  ongoingTreatment: string | null;
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
  const [age, setAge] = useState("");
  const [currentHealthPlan, setCurrentHealthPlan] = useState("");
  const [referenceHospital, setReferenceHospital] = useState("");
  const [ongoingTreatment, setOngoingTreatment] = useState("");

  useEffect(() => {
    if (!open) return;
    setAge(initialValues?.age ?? "");
    setCurrentHealthPlan(initialValues?.currentHealthPlan ?? "");
    setReferenceHospital(initialValues?.referenceHospital ?? "");
    setOngoingTreatment(initialValues?.ongoingTreatment ?? "");
  }, [open, initialValues]);

  const missing = useMemo(() => new Set(missingFields), [missingFields]);

  const handleSubmit = async () => {
    await onSave({
      ...(missing.has("age") ? { age } : {}),
      ...(missing.has("currentHealthPlan") ? { currentHealthPlan } : {}),
      ...(missing.has("referenceHospital") ? { referenceHospital } : {}),
      ...(missing.has("ongoingTreatment") ? { ongoingTreatment } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Informações obrigatórias do lead</DialogTitle>
          <DialogDescription>
            {leadName
              ? `Preencha os dados pendentes para continuar a movimentação do lead ${leadName}.`
              : "Preencha os dados pendentes para continuar a movimentação do lead."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {missing.has("age") && (
            <div className="grid gap-2">
              <Label>Faixas etárias *</Label>
              <AgeRangeInput value={age} onChange={setAge} disabled={isSaving} />
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
