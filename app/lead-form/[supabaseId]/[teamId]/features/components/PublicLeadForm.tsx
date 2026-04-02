"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  publicLeadFormSchema,
  type PublicLeadFormData,
} from "@/lib/validations/publicLeadFormSchema";
import { usePublicLeadFormContext } from "../context/PublicLeadFormContext";
import { SchedulingSection } from "./SchedulingSection";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { maskPhone, maskCNPJ, unmask } from "@/lib/masks";
import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

const parseCurrencyValue = (value: string): number | null => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const cents = digits.slice(-2).padStart(2, "0");
  const intPart = digits.slice(0, -2) || "0";
  return parseFloat(`${intPart}.${cents}`);
};

const toCurrencyStorageValue = (value: string): string | null => {
  const parsed = parseCurrencyValue(value);
  if (parsed === null || Number.isNaN(parsed)) return null;
  return parsed.toFixed(2);
};

const formatCurrencyInput = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = digits.slice(-2).padStart(2, "0");
  const intPart = digits.slice(0, -2) || "0";
  const formattedInt = Number(intPart).toLocaleString("pt-BR");
  return `R$ ${formattedInt},${cents}`;
};

const MAX_CURRENCY_VALUE = 9_999_999_999.99;
const MAX_CURRENCY_LABEL = "10.000.000.000,00";

const normalizeLeadPhoneDigits = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return digits;
  return digits.slice(-11);
};

const fieldLabelClassName = "block text-sm font-medium mb-1";
const fieldInputClassName = "h-9";
const fieldSelectTriggerClassName = "h-9";
const fieldTextareaClassName = "min-h-[84px] resize-y";

export function PublicLeadForm() {
  const {
    healthPlans,
    healthPlansLoading,
    closers,
    isSubmitting,
    isSubmitted,
    submitLead,
    resetForm,
  } = usePublicLeadFormContext();

  const [currentValueDisplay, setCurrentValueDisplay] = useState("");
  const [currentValueError, setCurrentValueError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Scheduling state
  const [closerId, setCloserId] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date | undefined>();
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");

  const form = useForm<PublicLeadFormData>({
    resolver: zodResolver(publicLeadFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      cnpj: "",
      age: "",
      currentHealthPlan: "",
      currentValue: "",
      referenceHospital: "",
      ongoingTreatment: "",
      additionalNotes: "",
    },
  });

  const watchedName = form.watch("name");

  const handleCurrencyChange = useCallback(
    (value: string) => {
      const parsed = parseCurrencyValue(value);
      if (parsed !== null && parsed > MAX_CURRENCY_VALUE) {
        const message = `Valor deve ser menor que ${MAX_CURRENCY_LABEL}`;
        setCurrentValueError(message);
        form.setError("currentValue", { type: "manual", message });
        return;
      }

      setCurrentValueError(null);
      form.clearErrors("currentValue");
      const formatted = formatCurrencyInput(value);
      const storage = toCurrencyStorageValue(value);
      setCurrentValueDisplay(formatted);
      form.setValue("currentValue", storage ?? "", { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const onSubmit = useCallback(
    async (data: PublicLeadFormData) => {
      if (submitting || isSubmitting) return;
      setSubmitting(true);

      try {
        const hasMeeting = !!(closerId && meetingDate && meetingTitle.trim());

        const result = await submitLead({
          name: data.name,
          email: data.email,
          phone: normalizeLeadPhoneDigits(data.phone),
          cnpj: data.cnpj ? unmask(data.cnpj) : undefined,
          age: data.age,
          currentHealthPlan: data.currentHealthPlan,
          currentValue: data.currentValue ? parseCurrencyValue(data.currentValue) ?? undefined : undefined,
          referenceHospital: data.referenceHospital,
          currentTreatment: data.ongoingTreatment,
          notes: data.additionalNotes || undefined,
          closerId: hasMeeting ? closerId : undefined,
          meetingDate: hasMeeting ? meetingDate!.toISOString() : undefined,
          meetingTitle: hasMeeting ? meetingTitle.trim() : undefined,
          meetingNotes: hasMeeting && meetingNotes ? meetingNotes : undefined,
        });

        if (result.isValid) {
          const message = result.successMessages[0] || "Lead cadastrado com sucesso!";
          toast.success(message);
          form.reset();
          setCurrentValueDisplay("");
          setCurrentValueError(null);
          setCloserId("");
          setMeetingDate(undefined);
          setMeetingTitle("");
          setMeetingNotes("");
        } else {
          const errorMsg = result.errorMessages[0] || "Erro ao cadastrar lead";
          toast.error(errorMsg);
        }
      } catch (error) {
        console.error("[PublicLeadFormContainer] Erro ao submeter:", error);
        toast.error("Erro ao cadastrar lead. Tente novamente.");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, isSubmitting, closerId, meetingDate, meetingTitle, meetingNotes, submitLead, form]
  );

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/corretor-studio-icon.svg"
              alt="Corretor Studio"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
            <span className="text-lg font-semibold">Corretor Studio</span>
          </div>
          <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">Lead cadastrado com sucesso!</h2>
            <p className="text-sm text-muted-foreground">
              Suas informações foram recebidas e o lead foi adicionado ao sistema.
            </p>
            <Button variant="outline" onClick={resetForm}>
              Cadastrar outro lead
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = submitting || isSubmitting;

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 pt-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/corretor-studio-icon.svg"
            alt="Corretor Studio"
            width={32}
            height={32}
            className="h-8 w-8"
            priority
          />
          <span className="text-lg font-semibold">Corretor Studio</span>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-semibold">Cadastro de Lead</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha os dados abaixo para registrar um novo lead
          </p>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-6 rounded-lg border p-4">
              {/* Lead Data Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Dados do Lead</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Nome *</FormLabel>
                      <FormControl>
                        <Input className={fieldInputClassName} placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Email *</FormLabel>
                      <FormControl>
                        <Input className={fieldInputClassName} type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Telefone *</FormLabel>
                      <FormControl>
                        <Input
                          className={fieldInputClassName}
                          placeholder="(00) 00000-0000"
                          value={maskPhone(normalizeLeadPhoneDigits(field.value || ""))}
                          onChange={(e) => {
                            const normalizedPhone = normalizeLeadPhoneDigits(e.target.value);
                            field.onChange(normalizedPhone);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Age */}
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Idades</FormLabel>
                      <FormControl>
                        <Input
                          className={fieldInputClassName}
                          placeholder="Ex: 30, 28, 5"
                          value={field.value || ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const digitsOnly = raw.replace(/[^0-9,\s]/g, "");
                            const endsWithSeparator = /[,\s]$/.test(digitsOnly);
                            const parts = digitsOnly.split(/[,\s]+/).filter(Boolean);
                            const normalized = parts
                              .map((part) => part.replace(/\D/g, ""))
                              .filter(Boolean);
                            let formatted = normalized.join(", ");
                            if (endsWithSeparator && normalized.length > 0) {
                              formatted += ", ";
                            }
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* CNPJ */}
                <FormField
                  control={form.control}
                  name="cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          className={fieldInputClassName}
                          placeholder="00.000.000/0000-00"
                          value={maskCNPJ(field.value || "")}
                          onChange={(e) => {
                            const masked = maskCNPJ(e.target.value);
                            const unmasked = unmask(masked);
                            field.onChange(unmasked);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Current Health Plan */}
                <FormField
                  control={form.control}
                  name="currentHealthPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Plano de Saúde Atual *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className={fieldSelectTriggerClassName}>
                            <SelectValue placeholder={healthPlansLoading ? "Carregando..." : "Selecione"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {healthPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.name}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Current Value */}
                <FormField
                  control={form.control}
                  name="currentValue"
                  render={() => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Valor Atual</FormLabel>
                      <FormControl>
                        <Input
                          className={fieldInputClassName}
                          placeholder="R$ 0,00"
                          value={currentValueDisplay}
                          onChange={(e) => handleCurrencyChange(e.target.value)}
                        />
                      </FormControl>
                      {currentValueError && (
                        <p className="text-xs text-destructive">{currentValueError}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Reference Hospital */}
                <FormField
                  control={form.control}
                  name="referenceHospital"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Hospital de Referência *</FormLabel>
                      <FormControl>
                        <Input className={fieldInputClassName} placeholder="Hospital de referência" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>

                {/* Ongoing Treatment - full width */}
                <FormField
                  control={form.control}
                  name="ongoingTreatment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Tratamento em Andamento *</FormLabel>
                      <FormControl>
                        <Input
                          className={fieldInputClassName}
                          placeholder="Descreva brevemente"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Additional Notes */}
                <FormField
                  control={form.control}
                  name="additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          className={fieldTextareaClassName}
                          placeholder="Observações adicionais"
                          {...field}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Scheduling Section */}
              {closers.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Agendar Reunião (opcional)</h3>
                    <SchedulingSection
                      leadName={watchedName || ""}
                      closerId={closerId}
                      onCloserIdChange={setCloserId}
                      meetingDate={meetingDate}
                      onMeetingDateChange={setMeetingDate}
                      meetingTitle={meetingTitle}
                      onMeetingTitleChange={setMeetingTitle}
                      meetingNotes={meetingNotes}
                      onMeetingNotesChange={setMeetingNotes}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                "Cadastrar Lead"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
