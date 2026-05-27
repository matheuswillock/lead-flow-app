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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { DateTimePicker } from "../ui/date-time-picker";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { maskPhone, formatDocumentInput, unmask } from "@/lib/masks";
import { AttachmentList } from "../ui/attachment-list";
import { Loader2, BadgeCheck, Badge as BadgeIcon, CalendarClock, CalendarSync, CalendarX2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useIsInView } from "@/hooks/use-is-in-view";
import { useTimezone } from "@/app/context/TimezoneContext";
import {
    getPendingRequiredFieldsFeedback,
    LEAD_REQUIRED_FIELD_ORDER,
} from "@/lib/validations/leadFormFeedback";

const formatCurrencyNumber = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

const MAX_CURRENCY_VALUE = 9_999_999_999.99;
const MAX_CURRENCY_LABEL = "10.000.000.000,00";

const parseCurrencyValue = (value: string): number | null => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return null;
    const cents = digits.slice(-2).padStart(2, '0');
    const intPart = digits.slice(0, -2) || '0';
    return parseFloat(`${intPart}.${cents}`);
};

const formatCurrencyInput = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const cents = digits.slice(-2).padStart(2, '0');
    const intPart = digits.slice(0, -2) || '0';
    const formattedInt = Number(intPart).toLocaleString('pt-BR');
    return `R$ ${formattedInt},${cents}`;
};

const toCurrencyStorageValue = (value: string): string | null => {
    const parsed = parseCurrencyValue(value);
    if (parsed === null || isNaN(parsed)) return null;
    return parsed.toFixed(2);
};

const normalizeLeadPhoneDigits = (value: string): string => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 11) return digits;
    return digits.slice(0, 11);
};

export interface ILeadFormProps {
    form: UseFormReturn<leadFormData>;
    onSubmit: (data: leadFormData) => void | Promise<void>;
    isLoading?: boolean;
    isUpdating?: boolean;
    supabaseId?: string;
    activeTeamId?: string;
    healthPlanOptions: Array<{ id: string; name: string }>;
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
        isOverdue?: boolean;
    };
    onManageSchedule?: () => void;
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
    isEditMode?: boolean;
    currentProfileId?: string;
    currentUserIsSdr?: boolean;
    currentUserIsCloser?: boolean;
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
    closersToAssign,
    sdrsToAssign,
    closersLoading,
    closersError,
    sdrsLoading,
    sdrsError,
    leadId,
    onUploadStateChange,
    onAttachmentsLoadingChange,
    isEditMode = false,
    currentProfileId,
    currentUserIsSdr = false,
    currentUserIsCloser = false,
}: ILeadFormProps) {
    const { tz } = useTimezone();
    const [hasChanges, setHasChanges] = useState(false);
    const [currentValueDisplay, setCurrentValueDisplay] = useState("");
    const [ticketDisplay, setTicketDisplay] = useState("");
    const [currentValueError, setCurrentValueError] = useState<string | null>(null);
    const [extraGuestsDraft, setExtraGuestsDraft] = useState("");
    const [ticketError, setTicketError] = useState<string | null>(null);
    const [cnpjDupError, setCnpjDupError] = useState<string | null>(null);
    const [cnpjChecking, setCnpjChecking] = useState(false);
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

    const buildEmailValue = (emails: string[]) => {
        const unique = Array.from(new Set(emails));
        return unique.join(", ");
    };

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const handleGuestDraftChange = (
        value: string,
        currentEmails: string[],
        onChange: (value: string) => void
    ) => {
        if (!value) {
            setExtraGuestsDraft("");
            return;
        }
        const parts = value.split(/[,;\s]+/);
        if (parts.length === 1) {
            setExtraGuestsDraft(value);
            return;
        }
        const last = value.match(/[,\s;]$/) ? "" : parts.pop() || "";
        const normalized = parts
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
            .filter(isValidEmail);
        if (normalized.length > 0) {
            onChange(buildEmailValue([...currentEmails, ...normalized]));
        }
        setExtraGuestsDraft(last);
    };

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
    const hasBlockingErrors = React.useMemo(() => {
        const entries = Object.entries(form.formState.errors);
        if (entries.length === 0) return false;

        return entries.some(([error]) => {
            const errorType = (error as { type?: string } | undefined)?.type;
            if (errorType !== "manual") {
                return false;
            }
            return true;
        });
    }, [form.formState.errors]);
    const isSchemaValid = React.useMemo(
        () => leadFormSchema.safeParse(watchedValues).success,
        [watchedValues]
    );
    const isSubmitDisabled = !hasChanges || hasBlockingErrors || !isSchemaValid || isLoading || isUpdating || cnpjChecking || cnpjDupError !== null;
    const meetingHealdValue = (scheduleSummary?.meetingHeald ?? "no") as "yes" | "no";

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
                (watchedValues.closerId && watchedValues.closerId.trim() !== '');

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
                watchedValues.closerId !== initialData.closerId;

        setHasChanges(hasFormChanges);
    }, [watchedValues, initialData, onMeetingHealdChange]);

    // Auto-select responsible when there's only one user available
    useEffect(() => {
        if (responsibleUsers?.length === 1 && !form.getValues('responsible')) {
            form.setValue('responsible', responsibleUsers[0].id);
        }
    }, [responsibleUsers, form]);

    useEffect(() => {
        const raw = form.getValues("currentValue");
        if (!raw) {
            setCurrentValueDisplay("");
            return;
        }
        const parsed = parseCurrencyValue(String(raw));
        if (parsed === null || isNaN(parsed)) {
            setCurrentValueDisplay("");
            return;
        }
        setCurrentValueDisplay(formatCurrencyNumber(parsed));
        if (typeof raw === "string" && /[R$,]/.test(raw)) {
            const storage = toCurrencyStorageValue(raw);
            if (storage) {
                form.setValue("currentValue", storage, { shouldDirty: false });
            }
        }
    }, [form]);

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
        if (isEditMode || !supabaseId || !activeTeamId || !cnpjUnmasked || cnpjUnmasked.trim().length === 0) return;
        setCnpjDupError(null);
        setCnpjChecking(true);
        try {
            const params = new URLSearchParams({ cnpj: cnpjUnmasked.trim() });
            const res = await fetch(`/api/v1/leads/cnpj-available?${params.toString()}`, {
                headers: {
                    "x-supabase-user-id": supabaseId,
                    "x-team-id": activeTeamId,
                },
            });
            if (res.status === 409) {
                setCnpjDupError("Já existe um lead com este CNPJ neste time");
            }
        } catch {
            // Ignore network errors — backend validation will catch at submit
        } finally {
            setCnpjChecking(false);
        }
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
            onSubmit={form.handleSubmit(onSubmit, () => {
                void handleInvalidSubmit();
            })}
            className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", className)}
        >            
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="block text-sm font-medium mb-1">Nome Completo*</FormLabel>
                    <FormControl>
                        <Input 
                            {...field}
                            required
                            autoComplete="name"
                            placeholder="Ex: Maria da Silva" 
                            disabled={isLoading || isUpdating}
                        />
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
                        <FormLabel className="block text-sm font-medium mb-1">Telefone*</FormLabel>
                        <FormControl>
                            <Input
                                value={maskPhone(normalizeLeadPhoneDigits(field.value || ''))}
                                onChange={(e) => {
                                    const normalizedPhone = normalizeLeadPhoneDigits(e.target.value);
                                    field.onChange(normalizedPhone);
                                }}
                                type="tel"
                                placeholder="(11) 91234-1234"
                                required
                                disabled={isLoading || isUpdating}
                                maxLength={20}
                            />
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
                        <FormLabel className="block text-sm font-medium mb-1">Email*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="email"
                                placeholder="email@exemplo.com"
                                required
                                disabled={isLoading || isUpdating}
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
                        <FormLabel className="block text-sm font-medium mb-1">CNPJ</FormLabel>
                        <FormControl>
                            <Input
                                value={formatDocumentInput(field.value || '')}
                                onChange={(e) => {
                                    const masked = formatDocumentInput(e.target.value);
                                    const unmasked = unmask(masked);
                                    field.onChange(unmasked);
                                    if (cnpjDupError) setCnpjDupError(null);
                                }}
                                onBlur={() => {
                                    field.onBlur();
                                    void handleCnpjBlur(field.value || '');
                                }}
                                type="text"
                                placeholder="00.000.000/0000-00"
                                disabled={isLoading || isUpdating}
                                maxLength={18}
                            />
                        </FormControl>
                        <FormMessage />
                        {cnpjDupError && (
                            <p className="text-sm font-medium text-destructive">{cnpjDupError}</p>
                        )}
                        {cnpjChecking && (
                            <p className="text-sm text-muted-foreground">Verificando CNPJ...</p>
                        )}
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">Faixas Etárias*</FormLabel>
                        <FormControl>
                            <div className="space-y-2">
                                <Input
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
                                    placeholder="Ex: 36, 32, 13"
                                    disabled={isLoading || isUpdating}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Exemplo: 12, 15, 22, 30, 120, 55. Digite dois caracteres e pressione espaco para adicionar a virgula automaticamente.
                                </p>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="sm:col-span-2">
                <FormField
                    control={form.control}
                    name="currentHealthPlan"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="block text-sm font-medium mb-1">
                                Qual o plano de saúde?*
                            </FormLabel>
                            <FormControl>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={isLoading || isUpdating || healthPlanOptionsLoading}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o plano atual ou 'Nova Adesão' se não possui" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {healthPlanNames.map((planName) => (
                                            <SelectItem key={`current-health-plan-${planName}`} value={planName}>
                                                {planName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField 
                control={form.control}
                name="currentValue"
                render={({ field }) => {
                    // Garantir que o valor sempre seja exibido formatado
                    return (
                        <FormItem>
                            <FormLabel className="block text-sm font-medium mb-1">Valor Atual</FormLabel>
                            <FormControl>
                                <Input
                                    value={currentValueDisplay}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed = parseCurrencyValue(raw);
                                        if (parsed !== null && parsed > MAX_CURRENCY_VALUE) {
                                            const message = `Valor deve ser menor que ${MAX_CURRENCY_LABEL}`;
                                            setCurrentValueError(message);
                                            form.setError("currentValue", { type: "manual", message });
                                            return;
                                        }
                                        setCurrentValueError(null);
                                        form.clearErrors("currentValue");
                                        const formatted = formatCurrencyInput(raw);
                                        const storage = toCurrencyStorageValue(raw);
                                        setCurrentValueDisplay(formatted);
                                        field.onChange(storage ?? "");
                                    }}
                                    type="text"
                                    placeholder="R$ 10,00"
                                    disabled={isLoading || isUpdating}
                                />
                            </FormControl>
                            {currentValueError && (
                                <p className="text-xs text-destructive">{currentValueError}</p>
                            )}
                        </FormItem>
                    );
                }}
            />

            <FormField
                control={form.control}
                name="referenceHospital"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">
                            Hospital Referência (se houver)*
                        </FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Digite o hospital"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="ongoingTreatment"
                render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">
                            Existe algum tratamento em andamento?*
                        </FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Descreva brevemente"
                                required
                                disabled={isLoading || isUpdating}
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
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">Observações Adicionais</FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Observações relevantes"
                                disabled={isLoading || isUpdating}
                                rows={3}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="sm:col-span-2 pt-4 border-t">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">Agendamento</h3>
                    <div className="flex items-center gap-2">
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
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Salvando...
                                    </span>
                                ) : meetingHealdValue === "yes" ? (
                                    <>
                                        <BadgeCheck className="h-4 w-4" />
                                        Reunião realizada
                                    </>
                                ) : (
                                    <>
                                        <BadgeIcon className="h-4 w-4" />
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
                                <CalendarX2 className="h-4 w-4" />
                                No-show
                            </Button>
                        )}
                        <Button type="button" variant="outline" onClick={onManageSchedule} disabled={!onManageSchedule}>
                            {scheduleSummary?.meetingDate ? (
                                <><CalendarSync className="h-4 w-4" />Editar agendamento</>
                            ) : (
                                <><CalendarClock className="h-4 w-4" />Agendar lead</>
                            )}
                        </Button>
                    </div>
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
                                    <span className="text-foreground">Titulo</span>
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
                                                {healthPlanNames.map((planName) => (
                                                    <SelectItem key={`sold-health-plan-${planName}`} value={planName}>
                                                        {planName}
                                                    </SelectItem>
                                                ))}
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
                                        <SelectTrigger className="h-9">
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

                <div
                    className="inline-flex"
                    onClick={() => {
                        if (isSubmitDisabled) {
                            void handleInvalidSubmit();
                        }
                    }}
                >
                    <Button 
                        type="submit" 
                        className={cn("cursor-pointer", isSubmitDisabled && "pointer-events-none")} 
                        disabled={isSubmitDisabled}
                    >
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isUpdating ? "Salvando..." : "Salvar"}
                    </Button>
                </div>
            </div>
            <div
                ref={formEndRef as React.RefObject<HTMLDivElement>}
                className="sm:col-span-2 h-px w-full"
                aria-hidden="true"
            />
        </form>
      </Form>
    );
}
