"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import {
  publicLeadFormSchema,
  type PublicLeadFormData,
} from "@/lib/validations/publicLeadFormSchema";
import { usePublicLeadFormContext } from "../context/PublicLeadFormContext";
import { SchedulingSection } from "./SchedulingSection";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AgeEntryInput } from "@/components/ui/age-entry-input";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { maskPhone, formatDocumentInput, unmask, normalizeLeadPhoneDigits } from "@/lib/masks";
import { useIsInView } from "@/hooks/use-is-in-view";
import {
  getPendingRequiredFieldsFeedback,
  LEAD_REQUIRED_FIELD_ORDER,
} from "@/lib/validations/leadFormFeedback";

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

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const parseExtraGuests = (value: string | undefined): string[] => {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(/[,;\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .filter((email) => isValidEmail(email))
    )
  );
};

const fieldLabelClassName = "block text-sm font-medium mb-1";
const fieldInputClassName = "h-9";
const fieldSelectTriggerClassName = "";
const fieldTextareaClassName = "min-h-[84px] resize-y";

export function PublicLeadForm() {
  const {
    bootstrapStatus,
    bootstrapError,
    healthPlans,
    healthPlansLoading,
    closers,
    sdrs,
    guestCandidates,
    isSubmitting,
    isSubmitted,
    submitLead,
    retryBootstrap,
    resetForm,
  } = usePublicLeadFormContext();

  const [currentValueDisplay, setCurrentValueDisplay] = useState("");
  const [currentValueError, setCurrentValueError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastInvalidHashRef = useRef<string>("");
  const { ref: formEndRef, isInView: hasReachedFormEnd } = useIsInView({
    threshold: 0.2,
  });

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
      responsible: "",
      extraGuests: "",
    },
  });

  const watchedValues = form.watch();
  const watchedName = form.watch("name");
  const watchedResponsible = form.watch("responsible");
  const watchedExtraGuests = form.watch("extraGuests") || "";
  const extraGuestsError =
    typeof form.formState.errors.extraGuests?.message === "string"
      ? form.formState.errors.extraGuests.message
      : null;

  useEffect(() => {
    if (!watchedResponsible && sdrs.length === 1) {
      form.setValue("responsible", sdrs[0].id, { shouldValidate: true });
    }
  }, [watchedResponsible, sdrs, form]);

  const handleExtraGuestsChange = useCallback(
    (value: string) => {
      form.setValue("extraGuests", value, { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

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
        const guests = parseExtraGuests(data.extraGuests);

        const result = await submitLead({
          name: data.name,
          email: data.email ?? "",
          phone: normalizeLeadPhoneDigits(data.phone || ""),
          cnpj: data.cnpj ? unmask(data.cnpj) : undefined,
          age: data.age ?? "",
          currentHealthPlan: data.currentHealthPlan ?? "",
          currentValue: data.currentValue ? parseCurrencyValue(data.currentValue) ?? undefined : undefined,
          referenceHospital: data.referenceHospital ?? "",
          currentTreatment: data.ongoingTreatment ?? "",
          notes: data.additionalNotes || undefined,
          assignedTo: data.responsible,
          closerId: hasMeeting ? closerId : undefined,
          meetingDate: hasMeeting ? meetingDate.toISOString() : undefined,
          meetingTitle: hasMeeting ? meetingTitle.trim() : undefined,
          meetingNotes: hasMeeting && meetingNotes ? meetingNotes : undefined,
          extraGuests: hasMeeting && guests.length > 0 ? guests : undefined,
        });

        if (result.isValid) {
          const message = result.successMessages[0] || "Lead cadastrado com sucesso!";
          toast.success(message);
          form.reset({
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
            responsible: "",
            extraGuests: "",
          });
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

  const handleInvalidSubmit = useCallback(async () => {
    if (submitting || isSubmitting) return;

    await form.trigger();
    const feedback = getPendingRequiredFieldsFeedback(
      publicLeadFormSchema,
      form.getValues(),
      LEAD_REQUIRED_FIELD_ORDER
    );

    if (!feedback.hasPendingFields) return;
    if (feedback.hash === lastInvalidHashRef.current) return;

    lastInvalidHashRef.current = feedback.hash;
    toast.error(feedback.message);

    if (feedback.firstPendingField) {
      try {
        form.setFocus(feedback.firstPendingField);
      } catch {
        // Some custom controls (e.g. Select) may not expose focus refs.
      }
    }
  }, [form, isSubmitting, submitting]);

  const isLoading = submitting || isSubmitting;
  const isSchemaValid = publicLeadFormSchema.safeParse(watchedValues).success;
  const hasManualBlockingErrors = Object.values(form.formState.errors).some((error) => {
    return (error as { type?: string } | undefined)?.type === "manual";
  });
  const isSubmitDisabled =
    isLoading || sdrs.length === 0 || !isSchemaValid || hasManualBlockingErrors;

  useEffect(() => {
    if (isSchemaValid) {
      lastInvalidHashRef.current = "";
    }
  }, [isSchemaValid]);

  useEffect(() => {
    if (!hasReachedFormEnd) return;
    if (!form.formState.isDirty) return;
    if (isSubmitted) return;
    if (isSchemaValid) return;
    if (isLoading) return;

    void handleInvalidSubmit();
  }, [
    form.formState.isDirty,
    handleInvalidSubmit,
    hasReachedFormEnd,
    isSchemaValid,
    isLoading,
    isSubmitted,
  ]);

  if (bootstrapStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (bootstrapStatus === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-lg border p-6 text-center">
          <h2 className="text-lg font-semibold">Não foi possível carregar o formulário</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {bootstrapError || "Tente novamente em instantes."}
          </p>
          <Button className="mt-4" onClick={retryBootstrap}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 pt-8">
      <div className="w-full max-w-2xl space-y-6">
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

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, () => {
              void handleInvalidSubmit();
            })}
            className="space-y-6"
          >
            <div className="space-y-6 rounded-lg border p-4">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Dados do Lead</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClassName}>E-mail</FormLabel>
                        <FormControl>
                          <Input className={fieldInputClassName} type="email" placeholder="email@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClassName}>Idades dos Beneficiários</FormLabel>
                        <FormControl>
                          <AgeEntryInput
                            value={field.value || ""}
                            onChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            value={formatDocumentInput(field.value || "")}
                            onChange={(e) => {
                              const masked = formatDocumentInput(e.target.value);
                              const unmasked = unmask(masked);
                              field.onChange(unmasked);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentHealthPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClassName}>Plano de Saúde Atual</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="referenceHospital"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={fieldLabelClassName}>Hospital de Referência</FormLabel>
                        <FormControl>
                          <Input className={fieldInputClassName} placeholder="Hospital de referência" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ongoingTreatment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>Tratamento em Andamento</FormLabel>
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
                      extraGuests={watchedExtraGuests}
                      extraGuestsError={extraGuestsError}
                      onExtraGuestsChange={handleExtraGuestsChange}
                      guestCandidates={guestCandidates}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              <Separator />
              <FormField
                control={form.control}
                name="responsible"
                render={({ field }) => {
                  const selectedSdr = sdrs.find((sdr) => sdr.id === field.value);
                  const isOnlyOneSdr = sdrs.length === 1;
                  const hasSdrOptions = sdrs.length > 0;

                  return (
                    <FormItem>
                      <FormLabel className={fieldLabelClassName}>
                        Responsável - SDR *{isOnlyOneSdr ? " (único disponível)" : ""}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading || !hasSdrOptions}
                      >
                        <FormControl>
                          <SelectTrigger className={fieldSelectTriggerClassName}>
                            <SelectValue
                              placeholder={hasSdrOptions ? "Selecione um SDR" : "Nenhum SDR disponível"}
                            >
                              {selectedSdr && (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={selectedSdr.avatarImageUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {selectedSdr.name
                                        .split(" ")
                                        .map((name) => name[0])
                                        .join("")
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">{selectedSdr.name}</span>
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sdrs.map((sdr) => (
                            <SelectItem key={sdr.id} value={sdr.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={sdr.avatarImageUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {sdr.name
                                      .split(" ")
                                      .map((name) => name[0])
                                      .join("")
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{sdr.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!hasSdrOptions && (
                        <p className="text-xs text-destructive">
                          Nenhum SDR disponível para este time.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div
              className="w-full"
              onClick={() => {
                if (isLoading || sdrs.length === 0) return;
                if (isSubmitDisabled) {
                  void handleInvalidSubmit();
                }
              }}
            >
              <Button
                type="submit"
                className={`w-full ${isSubmitDisabled ? "pointer-events-none" : ""}`}
                disabled={isSubmitDisabled}
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
            </div>
            <div
              ref={formEndRef as React.RefObject<HTMLDivElement>}
              className="h-px w-full"
              aria-hidden="true"
            />
          </form>
        </Form>
      </div>
    </div>
  );
}

