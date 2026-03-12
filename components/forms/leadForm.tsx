"use client";

import { cn } from "@/lib/utils";
import { leadFormData } from "@/lib/validations/validationForms";
import { useEffect, useState } from "react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { DateTimePicker } from "../ui/date-time-picker";
import { Checkbox } from "../ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { maskPhone, maskCNPJ, unmask } from "@/lib/masks";
import { AttachmentList } from "../ui/attachment-list";
import { Loader2, X } from "lucide-react";
import { CopyIcon } from "@/components/animate-ui/icons/copy";
import { toast } from "sonner";

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
    return digits.slice(-11);
};

export interface ILeadFormProps {
    form: UseFormReturn<leadFormData>;
    onSubmit: (data: leadFormData) => void | Promise<void>;
    isLoading?: boolean;
    isUpdating?: boolean;
    healthPlanOptions: Array<{ id: string; name: string }>;
    healthPlanOptionsLoading?: boolean;
    onCancel: () => void;
    className?: string;
    initialData?: leadFormData;
    showMeetingHeald?: boolean;
    meetingHealdReadOnly?: boolean;
    meetingHealdSaving?: boolean;
    onMeetingHealdChange?: (next: "yes" | "no") => void | Promise<void>;
    usersToAssign: UserAssociated[];
    closersToAssign?: UserAssociated[];
    sdrsToAssign?: UserAssociated[];
    leadId?: string; // ID do lead para exibir attachments (apenas em modo de edição)
    showMeetingLink?: boolean;
}

export function LeadForm({
    form,
    onSubmit,
    isLoading,
    isUpdating,
    healthPlanOptions,
    healthPlanOptionsLoading,
    onCancel,
    className,
    initialData,
    showMeetingHeald,
    meetingHealdReadOnly,
    meetingHealdSaving,
    onMeetingHealdChange,
    usersToAssign,
    closersToAssign,
    sdrsToAssign,
    leadId,
    showMeetingLink
}: ILeadFormProps) {
    const [hasChanges, setHasChanges] = useState(false);
    const [currentValueDisplay, setCurrentValueDisplay] = useState("");
    const [ticketDisplay, setTicketDisplay] = useState("");
    const [currentValueError, setCurrentValueError] = useState<string | null>(null);
    const [ticketError, setTicketError] = useState<string | null>(null);
    const [extraGuestsDraft, setExtraGuestsDraft] = useState("");
    const closers = React.useMemo(
        () => closersToAssign ?? [],
        [closersToAssign]
    );
    const sdrs = React.useMemo(
        () => sdrsToAssign ?? [],
        [sdrsToAssign]
    );

    const parseEmails = (value: string | undefined) => {
        if (!value) return [];
        return value
            .split(/[,;\s]+/)
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
    };

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

    const commitGuestDraft = (
        currentEmails: string[],
        onChange: (value: string) => void
    ) => {
        if (!extraGuestsDraft.trim()) return;
        handleGuestDraftChange(`${extraGuestsDraft} `, currentEmails, onChange);
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
    const isFormValid = form.formState.isValid;
    const isSubmitDisabled = !hasChanges || !isFormValid || isLoading || isUpdating;

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
                (watchedValues.meetingDate && watchedValues.meetingDate.trim() !== '') ||
                (!onMeetingHealdChange && watchedValues.meetingHeald && watchedValues.meetingHeald.trim() !== '') ||
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
                watchedValues.meetingDate !== initialData.meetingDate ||
                (!onMeetingHealdChange && watchedValues.meetingHeald !== initialData.meetingHeald) ||
                watchedValues.responsible !== initialData.responsible ||
                watchedValues.closerId !== initialData.closerId;

        setHasChanges(hasFormChanges);
    }, [watchedValues, initialData, onMeetingHealdChange]);

    // Auto-select responsible when there's only one user available
    useEffect(() => {
        if (sdrs?.length === 1 && !form.getValues('responsible')) {
            form.setValue('responsible', sdrs[0].id);
        }
    }, [sdrs, form]);

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

    return (
      <Form {...form}>
        <form
            onSubmit={form.handleSubmit(onSubmit)}
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
                                value={maskCNPJ(field.value || '')}
                                onChange={(e) => {
                                    const masked = maskCNPJ(e.target.value);
                                    const unmasked = unmask(masked);
                                    field.onChange(unmasked);
                                }}
                                type="text"
                                placeholder="00.000.000/0000-00"
                                disabled={isLoading || isUpdating}
                                maxLength={18}
                            />
                        </FormControl>
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
                            <FormLabel className="block text-sm font-medium mb-1">Valor Atual*</FormLabel>
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
                                    required
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
                            <Input
                                {...field}
                                placeholder="Observações relevantes"
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="sm:col-span-2 pt-4 border-t">
                <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold text-foreground">
                        Informacoes de agendamento
                    </h3>
                    {!!showMeetingHeald && (
                        <FormField
                            control={form.control}
                            name="meetingHeald"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value === "yes"}
                                            onCheckedChange={(value) => {
                                                const checked = value === true;
                                                const next = checked ? "yes" : "no";
                                                // Keep UI state in sync without forcing a full submit.
                                                field.onChange(next);
                                                onMeetingHealdChange?.(next);
                                            }}
                                            className="mt-[1px]"
                                            disabled={
                                                isLoading ||
                                                isUpdating ||
                                                meetingHealdSaving ||
                                                !!meetingHealdReadOnly
                                            }
                                        />
                                    </FormControl>
                                    <FormLabel className="text-sm font-medium leading-none mb-2">
                                        Reunião realizada?
                                    </FormLabel>
                                    {meetingHealdSaving && (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </FormItem>
                            )}
                        />
                    )}
                </div>
            </div>

            {/* Data, Horário e Responsável em uma linha no desktop */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                <FormField
                    control={form.control}
                    name="meetingDate"
                    render={({ field }) => (
                        <FormItem className="sm:flex-shrink-0">
                            <FormControl>
                                <DateTimePicker
                                    date={field.value ? new Date(field.value) : undefined}
                                    onDateChange={(date) => {
                                        field.onChange(date ? date.toISOString() : '');
                                    }}
                                    label="Data e Horário da Reunião"
                                    disabled={isLoading || isUpdating}
                                    disablePastDates={true}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="closerId"
                    render={({ field }) => {
                        const selectedCloser = closers.find((user) => user.id === field.value);
                        const isOnlyOneCloser = closers.length === 1;

                        useEffect(() => {
                            if (!field.value && closers.length === 1) {
                                field.onChange(closers[0].id);
                            }
                        }, [closers, field.value, field.onChange]);

                        return (
                            <FormItem className="flex flex-col sm:flex-1">
                                <FormLabel className="text-sm font-medium">
                                    Closer{isOnlyOneCloser && " (único disponível)"}
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        value={field.value || ""}
                                        onValueChange={field.onChange}
                                        disabled={isLoading || isUpdating || closers.length === 0}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue
                                                placeholder={
                                                    closers.length === 0
                                                        ? "Nenhum closer disponível"
                                                        : "Selecione um closer"
                                                }
                                            >
                                                {selectedCloser && (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage
                                                                src={selectedCloser.avatarImageUrl || undefined}
                                                            />
                                                            <AvatarFallback className="text-xs">
                                                                {selectedCloser.name
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")
                                                                    .toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="truncate">{selectedCloser.name}</span>
                                                    </div>
                                                )}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {closers.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage
                                                                src={user.avatarImageUrl || undefined}
                                                            />
                                                            <AvatarFallback className="text-xs">
                                                                {user.name
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")
                                                                    .toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span>{user.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                            </FormItem>
                        );
                    }}
                />

            </div>

            <FormField
                control={form.control}
                name="meetingNotes"
                render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">
                            Observações
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Adicione observacoes sobre a reuniao"
                                className="min-h-[84px] resize-y"
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

                    {showMeetingLink && (
                        <FormField
                            control={form.control}
                            name="meetingLink"
                            render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel className="block text-sm font-medium mb-1">
                                        Link da reuniao
                                    </FormLabel>
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                {...field}
                                                type="url"
                                                placeholder="https://meet.google.com/..."
                                                readOnly
                                                onFocus={(event) => event.currentTarget.select()}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 shrink-0"
                                                disabled={!field.value}
                                                onClick={async () => {
                                                    if (!field.value) return;
                                                    try {
                                                        await navigator.clipboard.writeText(field.value);
                                                        toast.success("Link da reuniao copiado");
                                                    } catch {
                                                        toast.error("Nao foi possivel copiar o link da reuniao");
                                                    }
                                                }}
                                                aria-label="Copiar link da reuniao"
                                            >
                                                <CopyIcon size={16} animateOnHover />
                                            </Button>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}

            <FormField
                control={form.control}
                name="extraGuests"
                render={({ field }) => {
                    const selectedEmails = parseEmails(field.value);
                    return (
                        <FormItem className="sm:col-span-2">
                            <FormLabel className="block text-sm font-medium mb-1">
                                Convidados extras (emails)
                            </FormLabel>
                            <FormControl>
                                <div className="grid gap-2">
                                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2">
                                        {selectedEmails.map((email) => (
                                            <Badge key={email} variant="secondary" className="gap-1 pr-1">
                                                <span>{email}</span>
                                                <button
                                                    type="button"
                                                    className="rounded-sm px-1 text-muted-foreground transition hover:text-foreground"
                                                    onClick={() => {
                                                        const next = selectedEmails.filter((item) => item !== email);
                                                        field.onChange(buildEmailValue(next));
                                                    }}
                                                    aria-label={`Remover ${email}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                        <input
                                            type="text"
                                            value={extraGuestsDraft}
                                            onChange={(e) =>
                                                handleGuestDraftChange(
                                                    e.target.value,
                                                    selectedEmails,
                                                    field.onChange
                                                )
                                            }
                                            onBlur={() => commitGuestDraft(selectedEmails, field.onChange)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    commitGuestDraft(selectedEmails, field.onChange);
                                                }
                                            }}
                                            placeholder="ex: convidado1@email.com, convidado2@email.com"
                                            className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                            disabled={isLoading || isUpdating}
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>Adicionar membros do time:</span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button type="button" variant="outline" size="sm">
                                                    Selecionar
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-60">
                                                {usersToAssign
                                                    .filter((user) => user.email)
                                                    .map((user) => {
                                                        const email = user.email;
                                                        const checked = selectedEmails.includes(email.toLowerCase());
                                                        return (
                                                            <DropdownMenuCheckboxItem
                                                                key={user.id}
                                                                checked={checked}
                                                                onCheckedChange={(nextChecked) => {
                                                                    const next = nextChecked
                                                                        ? [...selectedEmails, email]
                                                                        : selectedEmails.filter((item) => item !== email.toLowerCase());
                                                                    field.onChange(buildEmailValue(next));
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-5 w-5">
                                                                        <AvatarImage
                                                                            src={user.avatarImageUrl || undefined}
                                                                        />
                                                                        <AvatarFallback className="text-[10px]">
                                                                            {user.name
                                                                                .split(" ")
                                                                                .map((n) => n[0])
                                                                                .join("")
                                                                                .toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="truncate">{user.name}</span>
                                                                </div>
                                                            </DropdownMenuCheckboxItem>
                                                        );
                                                    })}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Separe os emails por virgula ou espaco.
                                    </p>
                                </div>
                            </FormControl>
                        </FormItem>
                    );
                }}
            />

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
                    <AttachmentList leadId={leadId} leadName={form.getValues("name")} />
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
                        const selectedValue = field.value || (sdrs?.[0]?.id ?? "");
                        const selectedUser = sdrs?.find(user => user.id === selectedValue);
                        const isOnlyOneUser = sdrs?.length === 1;
                        useEffect(() => {
                            if (!field.value && sdrs?.length > 0) {
                                field.onChange(sdrs[0].id);
                            }
                        }, [sdrs, field.value, field.onChange]);

                        return (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-sm font-medium">
                                    Responsável - SDR {isOnlyOneUser && " (único disponível)"}
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        value={selectedValue}
                                        onValueChange={field.onChange}
                                        disabled={isLoading || isUpdating || sdrs.length === 0}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue
                                                placeholder={
                                                    sdrs.length === 0
                                                        ? "Nenhum SDR disponível"
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
                                            {sdrs?.map(user => (
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

                <Button 
                    type="submit" 
                    className="cursor-pointer" 
                    disabled={isSubmitDisabled}
                >
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUpdating ? "Salvando..." : "Salvar"}
                </Button>
            </div>
        </form>
      </Form>
    );
}
