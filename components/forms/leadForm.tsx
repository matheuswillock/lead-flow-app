"use client";

import { cn } from "@/lib/utils";
import { leadFormData, leadFormSchema } from "@/lib/validations/validationForms";
import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { DateTimePicker } from "../ui/date-time-picker";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { AttachmentList } from "../ui/attachment-list";
import { SaveWithDraftButton } from "./SaveWithDraftButton";
import { BadgeCheck, Badge as BadgeIcon, CalendarClock, CalendarSync, CalendarX2, Copy, ExternalLink, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ReferralDialog } from "./referral-dialog";
import { useIsInView } from "@/hooks/use-is-in-view";
import { useTimezone } from "@/app/context/TimezoneContext";
import {
    formatCurrencyInput,
    MAX_CURRENCY_LABEL,
    MAX_CURRENCY_VALUE,
    parseCurrencyValue,
    toCurrencyStorageValue,
} from "@/lib/lead-form-utils";
import { LeadAdditionalNotesField } from "./fields/LeadAdditionalNotesField";
import { LeadAgeField } from "./fields/LeadAgeField";
import { LeadCnpjField } from "./fields/LeadCnpjField";
import { LeadRazaoSocialField } from "./fields/LeadRazaoSocialField";
import { LeadCurrentValueField } from "./fields/LeadCurrentValueField";
import { LeadEmailField } from "./fields/LeadEmailField";
import { LeadHealthPlanField } from "./fields/LeadHealthPlanField";
import { LeadNameField } from "./fields/LeadNameField";
import { LeadOngoingTreatmentField } from "./fields/LeadOngoingTreatmentField";
import { LeadPhoneField } from "./fields/LeadPhoneField";
import { LeadReferenceHospitalField } from "./fields/LeadReferenceHospitalField";
import {
    getPendingRequiredFieldsFeedback,
    LEAD_REQUIRED_FIELD_ORDER,
} from "@/lib/validations/leadFormFeedback";

const formatCurrencyNumber = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

export type LeadFormSaveMode = "full" | "draft";

export interface ILeadFormProps {
    form: UseFormReturn<leadFormData>;
    onSubmit: (data: leadFormData, mode: LeadFormSaveMode) => void | Promise<void>;
    isLoading?: boolean;
    isUpdating?: boolean;
    supabaseId?: string;
    activeTeamId?: string;
    healthPlanOptions: Array<{ id: string; name: string; iconUrl?: string | null }>;
    healthPlanOptionsLoading?: boolean;
    onCancel: () => void;
    className?: string;
    initialData?: leadFormData;
    scheduleSummary?: {
        status?: string | null;
        meetingDate?: string | null;
        closerName?: string | null;
        meetingTitle?: string | null;
        meetingNotes?: string | null;
        meetingLink?: string | null;
        meetingHeald?: "yes" | "no" | null;
        isPreSchedule?: boolean;
        isOverdue?: boolean;
    };
    onManageSchedule?: () => void;
    onShareSchedule?: () => void;
    onResendScheduleInvite?: () => void;
    canToggleMeetingHeald?: boolean;
    meetingHealdSaving?: boolean;
    onMeetingHealdChange?: (next: "yes" | "no") => void | Promise<void>;
    canMarkNoShow?: boolean;
    onMarkNoShow?: () => void | Promise<void>;
    usersToAssign: UserAssociated[];
    closersToAssign?: UserAssociated[];
    sdrsToAssign?: UserAssociated[];
    closersLoading?: boolean;
    closersError?: string | null;
    sdrsLoading?: boolean;
    sdrsError?: string | null;
    leadId?: string; // ID do lead para exibir attachments (apenas em modo de edição)
    onUploadStateChange?: (isUploading: boolean) => void;
    onAttachmentsLoadingChange?: (isLoading: boolean) => void;
    /** Anexos pré-carregados pelo endpoint agregado; evita fetch separado na montagem. */
    initialAttachments?: import("@/components/ui/attachment-list").Attachment[];
    isEditMode?: boolean;
    currentProfileId?: string;
    currentUserIsSdr?: boolean;
    currentUserIsCloser?: boolean;
    isFullSaveDisabled?: boolean;
    fullSaveDisabledReason?: string;
}

export function LeadForm({
    form,
    onSubmit,
    isLoading,
    isUpdating,
    supabaseId,
    activeTeamId,
    healthPlanOptions,
    healthPlanOptionsLoading,
    onCancel,
    className,
    initialData,
    scheduleSummary,
    onManageSchedule,
    canToggleMeetingHeald,
    meetingHealdSaving,
    onMeetingHealdChange,
    canMarkNoShow,
    onMarkNoShow,
    usersToAssign,
    sdrsToAssign,
    sdrsLoading,
    sdrsError,
    leadId,
    onUploadStateChange,
    onAttachmentsLoadingChange,
    initialAttachments,
    isEditMode = false,
    currentProfileId,
    currentUserIsSdr = false,
    currentUserIsCloser = false,
    isFullSaveDisabled = false,
    fullSaveDisabledReason,
    onShareSchedule,
    onResendScheduleInvite,
}: ILeadFormProps) {
    const { tz } = useTimezone();
    const [hasChanges, setHasChanges] = useState(false);
    const [ticketDisplay, setTicketDisplay] = useState("");
    const [ticketError, setTicketError] = useState<string | null>(null);
    const [referralDialogOpen, setReferralDialogOpen] = useState(false);
    const lastInvalidHashRef = useRef<string>("");
    const { ref: formEndRef, isInView: hasReachedFormEnd } = useIsInView({
        threshold: 0.2,
    });

    const sdrs = React.useMemo(
        () => sdrsToAssign ?? [],
        [sdrsToAssign]
    );
    const responsibleUsers = React.useMemo(() => {
        const base = sdrs.length > 0 ? sdrs : usersToAssign ?? [];
        if (currentUserIsSdr && currentProfileId) {
            const self = base.filter((u) => u.id === currentProfileId);
            return self.length > 0 ? self : base;
        }
        return base;
    }, [sdrs, usersToAssign, currentUserIsSdr, currentProfileId]);

    const watchedValues = form.watch();
    const healthPlanNames = React.useMemo(() => {
        const baseNames = healthPlanOptions
            .map((option) => option.name.trim())
            .filter(Boolean);
        const extras = [watchedValues.currentHealthPlan, watchedValues.soldPlan]
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value && !baseNames.includes(value));
        return [...baseNames, ...extras];
    }, [healthPlanOptions, watchedValues.currentHealthPlan, watchedValues.soldPlan]);
    const healthPlanIconByName = React.useMemo(() => {
        const map = new Map<string, string | null | undefined>();
        healthPlanOptions.forEach((option) => map.set(option.name.trim(), option.iconUrl));
        return map;
    }, [healthPlanOptions]);
    const hasBlockingErrors = React.useMemo(() => {
        const errors = Object.values(form.formState.errors);
        if (errors.length === 0) return false;

        return errors.some((error) => {
            const errorType = (error as { type?: string } | undefined)?.type;
            return errorType === "manual";
        });
    }, [form.formState.errors]);
    const isSchemaValid = React.useMemo(
        () => leadFormSchema.safeParse(watchedValues).success,
        [watchedValues]
    );
    const isDraftDisabled = !hasChanges || hasBlockingErrors || !isSchemaValid || isLoading || isUpdating;
    const isSaveDisabled = isDraftDisabled || isFullSaveDisabled;
    const meetingHealdValue = (scheduleSummary?.meetingHeald ?? "no") as "yes" | "no";
    const isPreSchedule =
        watchedValues.isTransfer === true || scheduleSummary?.isPreSchedule === true;
    const scheduleSectionTitle = isPreSchedule ? "Pré-agendamento" : "Agendamento";
    const manageScheduleLabel = scheduleSummary?.meetingDate
        ? isPreSchedule
            ? "Editar pré-agendamento"
            : "Editar agendamento"
        : "Agendar lead";
    const canResendScheduleInvite =
        !!onResendScheduleInvite &&
        !!scheduleSummary?.meetingDate &&
        scheduleSummary?.status === "scheduled" &&
        !isPreSchedule;

    useEffect(() => {
        if (!initialData) {
            const hasAnyData = 
                (watchedValues.name && watchedValues.name.trim() !== '') ||
                (watchedValues.email && watchedValues.email.trim() !== '') ||
                (watchedValues.phone && watchedValues.phone.trim() !== '') ||
                (watchedValues.cnpj && watchedValues.cnpj.trim() !== '') ||
                (watchedValues.age && watchedValues.age.length > 0) ||
                (watchedValues.currentHealthPlan && watchedValues.currentHealthPlan.trim() !== '') ||
                (watchedValues.currentValue && watchedValues.currentValue.trim() !== '') ||
                (watchedValues.referenceHospital && watchedValues.referenceHospital.trim() !== '') ||
                (watchedValues.ongoingTreatment && watchedValues.ongoingTreatment.trim() !== '') ||
                (watchedValues.additionalNotes && watchedValues.additionalNotes.trim() !== '') ||
                (watchedValues.responsible && watchedValues.responsible.trim() !== '') ||
                (watchedValues.closerId && watchedValues.closerId.trim() !== '') ||
                watchedValues.isTransfer === true ||
                watchedValues.isReferral ||
                (watchedValues.referrerLeadId && watchedValues.referrerLeadId.trim() !== '') ||
                (watchedValues.referrerName && watchedValues.referrerName.trim() !== '') ||
                (watchedValues.referrerPhone && watchedValues.referrerPhone.trim() !== '');

            setHasChanges(!!hasAnyData);
            return;
        }

        // Modo de edição - verificar se há mudanças em relação aos dados iniciais
            const hasFormChanges = 
                watchedValues.name !== initialData.name ||
                watchedValues.email !== initialData.email ||
                watchedValues.phone !== initialData.phone ||
                watchedValues.cnpj !== initialData.cnpj ||
                watchedValues.age !== initialData.age ||
                watchedValues.currentHealthPlan !== initialData.currentHealthPlan ||
                watchedValues.currentValue !== initialData.currentValue ||
                watchedValues.referenceHospital !== initialData.referenceHospital ||
                watchedValues.ongoingTreatment !== initialData.ongoingTreatment ||
                watchedValues.additionalNotes !== initialData.additionalNotes ||
                watchedValues.responsible !== initialData.responsible ||
                watchedValues.closerId !== initialData.closerId ||
                watchedValues.isTransfer !== initialData.isTransfer ||
                watchedValues.isReferral !== initialData.isReferral ||
                watchedValues.referrerLeadId !== initialData.referrerLeadId ||
                watchedValues.referrerName !== initialData.referrerName ||
                watchedValues.referrerPhone !== initialData.referrerPhone;

        setHasChanges(hasFormChanges);
    }, [watchedValues, initialData, onMeetingHealdChange]);

    // Auto-select responsible when there's only one user available
    useEffect(() => {
        if (responsibleUsers?.length === 1 && !form.getValues('responsible')) {
            form.setValue('responsible', responsibleUsers[0].id);
        }
    }, [responsibleUsers, form]);

    useEffect(() => {
        const raw = form.getValues("ticket");
        if (!raw) {
            setTicketDisplay("");
            return;
        }
        const parsed = parseCurrencyValue(String(raw));
        if (parsed === null || isNaN(parsed)) {
            setTicketDisplay("");
            return;
        }
        setTicketDisplay(formatCurrencyNumber(parsed));
        if (typeof raw === "string" && /[R$,]/.test(raw)) {
            const storage = toCurrencyStorageValue(raw);
            if (storage) {
                form.setValue("ticket", storage, { shouldDirty: false });
            }
        }
    }, [form]);

    useEffect(() => {
        if (isSchemaValid) {
            lastInvalidHashRef.current = "";
        }
    }, [isSchemaValid]);

    const handleCnpjBlur = useCallback(async (cnpjUnmasked: string) => {
        if (isEditMode || !supabaseId || !activeTeamId || !cnpjUnmasked || cnpjUnmasked.trim().length === 0) {
            return null;
        }
        try {
            const params = new URLSearchParams({ cnpj: cnpjUnmasked.trim() });
            const res = await fetch(`/api/v1/leads/cnpj-available?${params.toString()}`, {
                headers: {
                    "x-supabase-user-id": supabaseId,
                    "x-team-id": activeTeamId,
                },
            });
            if (res.status === 409) {
                return "Já existe um lead com este CNPJ neste time";
            }
        } catch {
            // Ignore network errors — backend validation will catch at submit
        }
        return null;
    }, [isEditMode, supabaseId, activeTeamId]);

    const handleInvalidSubmit = useCallback(async () => {
        if (isLoading || isUpdating) return;

        await form.trigger();
        const feedback = getPendingRequiredFieldsFeedback(
            leadFormSchema,
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
    }, [form, isLoading, isUpdating]);

    const runSubmit = useCallback(
        (mode: LeadFormSaveMode) => {
            void form.handleSubmit(
                (data) => onSubmit(data, mode),
                () => {
                    void handleInvalidSubmit();
                }
            )();
        },
        [form, handleInvalidSubmit, onSubmit]
    );

    const handleSaveFull = useCallback(() => {
        if (isSaveDisabled) {
            if (isFullSaveDisabled && fullSaveDisabledReason) {
                toast.error(fullSaveDisabledReason);
                return;
            }
            void handleInvalidSubmit();
            return;
        }
        runSubmit("full");
    }, [fullSaveDisabledReason, handleInvalidSubmit, isFullSaveDisabled, isSaveDisabled, runSubmit]);

    const handleSaveDraft = useCallback(() => {
        if (isDraftDisabled) {
            void handleInvalidSubmit();
            return;
        }
        runSubmit("draft");
    }, [handleInvalidSubmit, isDraftDisabled, runSubmit]);

    useEffect(() => {
        if (!hasReachedFormEnd) return;
        if (!hasChanges) return;
        if (isSchemaValid) return;
        if (isLoading || isUpdating) return;

        void handleInvalidSubmit();
    }, [
        hasChanges,
        hasReachedFormEnd,
        isLoading,
        isSchemaValid,
        isUpdating,
        handleInvalidSubmit,
    ]);

    return (
      <Form {...form}>
        <form
            onSubmit={(event) => {
                event.preventDefault();
                handleSaveFull();
            }}
            className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", className)}
        >            
            <LeadNameField control={form.control} disabled={isLoading || isUpdating} />
            <LeadPhoneField control={form.control} disabled={isLoading || isUpdating} />
            <LeadEmailField control={form.control} disabled={isLoading || isUpdating} />
            <LeadCnpjField
                control={form.control}
                disabled={isLoading || isUpdating}
                onDuplicateCheck={handleCnpjBlur}
            />
            <LeadRazaoSocialField
                control={form.control}
                disabled={isLoading || isUpdating}
                isLookupPending={isLoading || isUpdating}
            />
            <LeadAgeField control={form.control} disabled={isLoading || isUpdating} />

            <div className="sm:col-span-2 rounded-md border border-border p-3">
                <FormField
                    control={form.control}
                    name="isReferral"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                            <div className="grid gap-1">
                                <FormLabel className="mb-0">Indicação</FormLabel>
                                <p className="text-xs text-muted-foreground">Marque quando este lead veio por indicação.</p>
                            </div>
                            <FormControl>
                                <Checkbox
                                    checked={!!field.value}
                                    onCheckedChange={(checked) => {
                                        const isChecked = !!checked;
                                        field.onChange(isChecked);
                                        if (!isChecked) {
                                            form.setValue("referrerLeadId", "");
                                            form.setValue("referrerName", "");
                                            form.setValue("referrerPhone", "");
                                        }
                                    }}
                                    disabled={isLoading || isUpdating}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                {form.watch("isReferral") && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                            {!!form.watch("referrerName") && <Badge variant="secondary">{form.watch("referrerName")}</Badge>}
                            {!!form.watch("referrerPhone") && <Badge variant="outline">{form.watch("referrerPhone")}</Badge>}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setReferralDialogOpen(true)}
                            disabled={isLoading || isUpdating}
                        >
                            {form.watch("referrerName") ? "Editar indicação" : "Selecionar indicador"}
                        </Button>
                    </div>
                )}
            </div>

            <LeadHealthPlanField
                control={form.control}
                disabled={isLoading || isUpdating}
                loading={healthPlanOptionsLoading}
                options={healthPlanNames.map((planName) => ({
                    id: `current-health-plan-${planName}`,
                    name: planName,
                    iconUrl: healthPlanIconByName.get(planName),
                }))}
            />
            <LeadCurrentValueField
                control={form.control}
                disabled={isLoading || isUpdating}
                setValue={form.setValue}
                setError={form.setError}
                clearErrors={form.clearErrors}
            />
            <LeadReferenceHospitalField control={form.control} disabled={isLoading || isUpdating} />
            <LeadOngoingTreatmentField control={form.control} disabled={isLoading || isUpdating} />
            <LeadAdditionalNotesField control={form.control} disabled={isLoading || isUpdating} />

            <div className="sm:col-span-2 pt-4 border-t">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-foreground">{scheduleSectionTitle}</h3>
                        <Button type="button" variant="outline" onClick={onManageSchedule} disabled={!onManageSchedule}>
                            {scheduleSummary?.meetingDate ? (
                                <>
                                    <CalendarSync data-icon="inline-start" />
                                    {manageScheduleLabel}
                                </>
                            ) : (
                                <>
                                    <CalendarClock data-icon="inline-start" />
                                    {manageScheduleLabel}
                                </>
                            )}
                        </Button>
                    </div>
                    {isPreSchedule && (
                        <p className="text-xs text-muted-foreground">
                            Aguardando transferência — ainda não está no status Agendado.
                        </p>
                    )}
                </div>

                <div className="mt-3 rounded-md border border-dashed border-border/70 bg-muted/30 p-3 grid gap-2 text-sm text-muted-foreground">
                    {scheduleSummary?.meetingDate ? (
                        <>
                            <div className="grid gap-1">
                                <span className="text-foreground">Data/hora</span>
                                <span>{new Date(scheduleSummary.meetingDate).toLocaleString("pt-BR")}</span>
                            </div>
                            {!!scheduleSummary?.closerName && (
                                <div className="grid gap-1">
                                    <span className="text-foreground">Closer</span>
                                    <span>{scheduleSummary.closerName}</span>
                                </div>
                            )}
                            {!!scheduleSummary?.meetingTitle && (
                                <div className="grid gap-1">
                                    <span className="text-foreground">Título</span>
                                    <span>{scheduleSummary.meetingTitle}</span>
                                </div>
                            )}
                            {!!scheduleSummary?.meetingLink && (
                                <div className="grid gap-1">
                                    <span className="text-foreground">Link</span>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            readOnly
                                            value={scheduleSummary.meetingLink}
                                            className="h-8 text-xs bg-transparent cursor-default flex-1"
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() =>
                                                navigator.clipboard
                                                    .writeText(scheduleSummary.meetingLink!)
                                                    .then(() => toast.success("Link copiado"))
                                            }
                                            aria-label="Copiar link"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => window.open(scheduleSummary.meetingLink!, "_blank")}
                                            aria-label="Abrir link"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        {!!onShareSchedule && (
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 shrink-0"
                                                onClick={onShareSchedule}
                                                aria-label="Compartilhar agendamento"
                                            >
                                                <Share2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                            {!!scheduleSummary?.meetingNotes && (
                                <div className="grid gap-1">
                                    <span className="text-foreground">Notas</span>
                                    <Textarea
                                        readOnly
                                        value={scheduleSummary.meetingNotes}
                                        className="resize-none text-muted-foreground bg-transparent cursor-default"
                                        rows={3}
                                    />
                                </div>
                            )}
                            {(!!canToggleMeetingHeald || !!canMarkNoShow || canResendScheduleInvite) && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {!!canToggleMeetingHeald && (
                                        <Button
                                            type="button"
                                            variant={meetingHealdValue === "yes" ? "default" : "outline"}
                                            disabled={isLoading || isUpdating || meetingHealdSaving}
                                            onClick={() => {
                                                const next = meetingHealdValue === "yes" ? "no" : "yes";
                                                onMeetingHealdChange?.(next);
                                            }}
                                        >
                                            {meetingHealdSaving ? (
                                                <>
                                                    <Loader2 data-icon="inline-start" className="animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : meetingHealdValue === "yes" ? (
                                                <>
                                                    <BadgeCheck data-icon="inline-start" />
                                                    Reunião realizada
                                                </>
                                            ) : (
                                                <>
                                                    <BadgeIcon data-icon="inline-start" />
                                                    Reunião realizada
                                                </>
                                            )}
                                        </Button>
                                    )}
                                    {!!canMarkNoShow && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={isLoading || isUpdating}
                                            onClick={() => {
                                                void onMarkNoShow?.();
                                            }}
                                        >
                                            <CalendarX2 data-icon="inline-start" />
                                            No-show
                                        </Button>
                                    )}
                                    {canResendScheduleInvite && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={onResendScheduleInvite}
                                            disabled={isLoading || isUpdating}
                                        >
                                            <Mail data-icon="inline-start" />
                                            Reenviar convite
                                        </Button>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <span>Nenhum agendamento registrado.</span>
                    )}
                </div>
            </div>

            {/* Campos adicionais apenas para leads em edição */}
            {leadId && (
                <>
                    <div className="sm:col-span-2 pt-4 border-t">
                        <h3 className="text-sm font-semibold mb-4 text-foreground">
                            Informações de Venda
                        </h3>
                    </div>

                    <FormField
                        control={form.control}
                        name="ticket"
                        render={({ field }) => {
                            return (
                                <FormItem>
                                    <FormLabel className="block text-sm font-medium mb-1">Ticket (Valor Vendido)</FormLabel>
                                    <FormControl>
                                        <Input
                                            value={ticketDisplay}
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const parsed = parseCurrencyValue(raw);
                                                if (parsed !== null && parsed > MAX_CURRENCY_VALUE) {
                                                    const message = `Ticket deve ser menor que ${MAX_CURRENCY_LABEL}`;
                                                    setTicketError(message);
                                                    form.setError("ticket", { type: "manual", message });
                                                    return;
                                                }
                                                setTicketError(null);
                                                form.clearErrors("ticket");
                                                const formatted = formatCurrencyInput(raw);
                                                const storage = toCurrencyStorageValue(raw);
                                                setTicketDisplay(formatted);
                                                field.onChange(storage ?? "");
                                            }}
                                            type="text"
                                            placeholder="R$ 0,00"
                                            disabled={isLoading || isUpdating}
                                        />
                                    </FormControl>
                                    {ticketError && (
                                        <p className="text-xs text-destructive">{ticketError}</p>
                                    )}
                                </FormItem>
                            );
                        }}
                    />

                    <FormField
                        control={form.control}
                        name="contractDueDate"
                        render={({ field }) => (
                            <FormItem className="">
                                
                                    <FormLabel className="block text-sm font-medium mb-1">Data de Vigência do Contrato</FormLabel>
                                <FormControl>
                                    <DateTimePicker
                                        date={field.value ? new Date(field.value) : undefined}
                                        onDateChange={(date) => {
                                            field.onChange(date ? date.toISOString() : '');
                                        }}
                                        label=""
                                        disabled={isLoading || isUpdating}
                                        disablePastDates={false}
                                        showTime={false}
                                        tz={tz}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <div className="sm:col-span-2">
                        <FormField
                            control={form.control}
                            name="soldPlan"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="block text-sm font-medium mb-1">
                                        Plano Vendido
                                    </FormLabel>
                                    <FormControl>
                                        <Select
                                            value={field.value || ""}
                                            onValueChange={field.onChange}
                                            disabled={isLoading || isUpdating || healthPlanOptionsLoading}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o plano vendido" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {healthPlanNames.map((planName) => {
                                                    const iconUrl = healthPlanIconByName.get(planName);
                                                    return (
                                                        <SelectItem key={`sold-health-plan-${planName}`} value={planName}>
                                                            <span className="flex items-center gap-2">
                                                                {iconUrl ? (
                                                                    <img src={iconUrl} alt="" className="size-4 rounded object-cover" />
                                                                ) : null}
                                                                {planName}
                                                            </span>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                )}
            />
        </div>

                </>
            )}

            {/* Seção de Attachments */}
            <div className="sm:col-span-2 pt-4 border-t">
                <div className="mb-2">
                    <h3 className="text-sm font-medium">Anexos</h3>
                    <p className="text-xs text-muted-foreground">
                        {leadId 
                            ? "Adicione documentos, imagens ou arquivos relacionados a este lead" 
                            : "Você poderá adicionar anexos após salvar o lead"}
                    </p>
                </div>
                {leadId ? (
                    <AttachmentList
                        leadId={leadId}
                        leadName={form.getValues("name")}
                        onUploadStateChange={onUploadStateChange}
                        onLoadingChange={onAttachmentsLoadingChange}
                        initialAttachments={initialAttachments}
                        supabaseId={supabaseId}
                        teamId={activeTeamId}
                    />
                ) : (
                    <div className="flex items-center justify-center p-8 border border-dashed rounded-lg bg-muted/20">
                        <div className="text-center space-y-2">
                            <div className="flex justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-muted-foreground/50"
                                >
                                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Salve o lead primeiro para adicionar anexos
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="sm:col-span-2">
                <FormField
                    control={form.control}
                    name="responsible"
                    render={({ field }) => {
                        const selectedValue = field.value || (responsibleUsers?.[0]?.id ?? "");
                        const selectedUser = responsibleUsers?.find(user => user.id === selectedValue);
                        const isOnlyOneUser = responsibleUsers?.length === 1;
                        const hasResponsibleOptions = responsibleUsers.length > 0;
                        const isLoadingWithoutOptions = !!sdrsLoading && !hasResponsibleOptions;
                        const hasErrorWithoutFallback = !!sdrsError && !hasResponsibleOptions;
                        const hasNoMembersAvailable =
                            !isLoadingWithoutOptions &&
                            !hasErrorWithoutFallback &&
                            !hasResponsibleOptions;
                        useEffect(() => {
                            if (!responsibleUsers?.length) {
                                return;
                            }

                            const preferredResponsibleId =
                                !isEditMode &&
                                currentUserIsSdr &&
                                currentProfileId &&
                                responsibleUsers.some((user) => user.id === currentProfileId)
                                    ? currentProfileId
                                    : responsibleUsers[0].id;

                            if (!field.value) {
                                field.onChange(preferredResponsibleId);
                                return;
                            }

                            const responsibleFieldState = form.getFieldState("responsible");
                            if (
                                !isEditMode &&
                                !responsibleFieldState.isDirty &&
                                currentUserIsSdr &&
                                currentProfileId &&
                                field.value !== currentProfileId &&
                                responsibleUsers.some((user) => user.id === currentProfileId)
                            ) {
                                field.onChange(currentProfileId);
                            }
                        }, [
                            responsibleUsers,
                            field.value,
                            field.onChange,
                            form,
                            isEditMode,
                            currentProfileId,
                            currentUserIsSdr,
                        ]);

                        return (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-sm font-medium">
                                    Responsável - SDR {isOnlyOneUser && " (único disponível)"}
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        value={selectedValue}
                                        onValueChange={field.onChange}
                                        disabled={
                                            isLoading ||
                                            isUpdating ||
                                            isLoadingWithoutOptions ||
                                            !hasResponsibleOptions ||
                                            currentUserIsSdr ||
                                            currentUserIsCloser
                                        }
                                    >
                                        <SelectTrigger className="">
                                            <SelectValue
                                                placeholder={
                                                    isLoadingWithoutOptions
                                                        ? "Carregando responsáveis..."
                                                        : hasErrorWithoutFallback
                                                            ? "Erro ao carregar responsáveis"
                                                            : hasNoMembersAvailable
                                                        ? "Nenhum membro disponível"
                                                        : "Selecione um responsável"
                                                }
                                            >
                                                {selectedUser && (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage
                                                                src={selectedUser.avatarImageUrl || undefined}
                                                            />
                                                            <AvatarFallback className="text-xs">
                                                                {selectedUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="truncate">{selectedUser.name}</span>
                                                    </div>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {responsibleUsers?.map(user => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage
                                                                src={user.avatarImageUrl || undefined} 
                                                            />
                                                            <AvatarFallback className="text-xs">
                                                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span>{user.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                {sdrsError && !hasResponsibleOptions && (
                                    <p className="mt-1 text-xs text-destructive">{sdrsError}</p>
                                )}
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2 mb-4">
                <Button 
                    className="cursor-pointer" 
                    type="button" 
                    variant="ghost" 
                    onClick={onCancel}
                    disabled={isLoading || isUpdating}
                >
                    Cancelar
                </Button>

                <SaveWithDraftButton
                    isLoading={isLoading || isUpdating}
                    isSaveDisabled={isSaveDisabled}
                    isDraftDisabled={isDraftDisabled}
                    onSaveFull={handleSaveFull}
                    onSaveDraft={handleSaveDraft}
                />
            </div>
            <div
                ref={formEndRef as React.RefObject<HTMLDivElement>}
                className="sm:col-span-2 h-px w-full"
                aria-hidden="true"
            />
        </form>
        <ReferralDialog
            open={referralDialogOpen}
            onOpenChange={setReferralDialogOpen}
            teamId={activeTeamId}
            initialValue={{
                referrerLeadId: form.watch("referrerLeadId") || "",
                referrerName: form.watch("referrerName") || "",
                referrerPhone: form.watch("referrerPhone") || "",
            }}
            onConfirm={(value) => {
                form.setValue("isReferral", true, { shouldDirty: true });
                form.setValue("referrerLeadId", value.referrerLeadId || "", { shouldDirty: true });
                form.setValue("referrerName", value.referrerName || "", { shouldDirty: true });
                form.setValue("referrerPhone", value.referrerPhone || "", { shouldDirty: true });
            }}
        />
      </Form>
    );
}
