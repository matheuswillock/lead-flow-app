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
import { normalizeLeadPhoneDigits, unmask } from "@/lib/masks";
import { parseCurrencyValue } from "@/lib/lead-form-utils";
import { useIsInView } from "@/hooks/use-is-in-view";
import { LeadAdditionalNotesField } from "@/components/forms/fields/LeadAdditionalNotesField";
import { LeadAgeField } from "@/components/forms/fields/LeadAgeField";
import { LeadCnpjField } from "@/components/forms/fields/LeadCnpjField";
import { LeadCurrentValueField } from "@/components/forms/fields/LeadCurrentValueField";
import { LeadEmailField } from "@/components/forms/fields/LeadEmailField";
import { LeadHealthPlanField } from "@/components/forms/fields/LeadHealthPlanField";
import { LeadNameField } from "@/components/forms/fields/LeadNameField";
import { LeadOngoingTreatmentField } from "@/components/forms/fields/LeadOngoingTreatmentField";
import { LeadPhoneField } from "@/components/forms/fields/LeadPhoneField";
import { LeadReferenceHospitalField } from "@/components/forms/fields/LeadReferenceHospitalField";
import {
  getPendingRequiredFieldsFeedback,
  LEAD_REQUIRED_FIELD_ORDER,
} from "@/lib/validations/leadFormFeedback";

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

const fieldSelectTriggerClassName = "";

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
                  <LeadNameField control={form.control} disabled={isLoading} />
                  <LeadPhoneField control={form.control} disabled={isLoading} />
                  <LeadEmailField control={form.control} disabled={isLoading} />
                  <LeadCnpjField control={form.control} disabled={isLoading} />
                  <LeadAgeField control={form.control} disabled={isLoading} />
                  <LeadHealthPlanField
                    control={form.control}
                    disabled={isLoading}
                    loading={healthPlansLoading}
                    options={healthPlans.map((plan) => ({
                      id: plan.id,
                      name: plan.name,
                      iconUrl: null,
                    }))}
                  />
                  <LeadCurrentValueField
                    control={form.control}
                    disabled={isLoading}
                    setValue={form.setValue}
                    setError={form.setError}
                    clearErrors={form.clearErrors}
                  />
                  <LeadReferenceHospitalField control={form.control} disabled={isLoading} />
                </div>

                <LeadOngoingTreatmentField control={form.control} disabled={isLoading} />
                <LeadAdditionalNotesField control={form.control} disabled={isLoading} />
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
                      <FormLabel className="mb-1 block text-sm font-medium">
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

