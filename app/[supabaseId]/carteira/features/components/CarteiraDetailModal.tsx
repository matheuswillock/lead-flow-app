"use client";

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, File, FileText, Image, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDocumentInput, formatRgCpfInput, sanitizeRgCpfDigits } from '@/lib/masks';
import {
  PORTFOLIO_STATUS_LABELS,
  type CarteiraDetailAttachment,
  type CarteiraDetailData,
  type UpdateCarteiraDetailPayload,
} from '../context/CarteiraTypes';

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  pending: 'secondary',
  canceled: 'destructive',
};

const PARENTESCO_OPTIONS = [
  { value: 'pai', label: 'Pai' },
  { value: 'mae', label: 'Mãe' },
  { value: 'filho', label: 'Filho(a)' },
  { value: 'conjuge', label: 'Cônjuge' },
  { value: 'sobrinho', label: 'Sobrinho(a)' },
  { value: 'neto', label: 'Neto(a)' },
  { value: 'avo', label: 'Avô/Avó' },
  { value: 'tio', label: 'Tio(a)' },
  { value: 'irmao', label: 'Irmão/Irmã' },
];

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function parseCurrencyInput(value: string): number {
  const clean = value.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function formatCurrencyInput(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function toPickerDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function fromPickerDate(value: Date | undefined): string {
  if (!value) return '';
  try {
    return format(value, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function ProfileBadge({ person }: { person: { id: string; name: string } | null }) {
  if (!person) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="text-[10px]">{getInitials(person.name)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{person.name}</span>
    </div>
  );
}

function FileIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith('image/')) return <Image className="size-4 shrink-0 text-muted-foreground" />;
  if (fileType === 'application/pdf') return <FileText className="size-4 shrink-0 text-muted-foreground" />;
  return <File className="size-4 shrink-0 text-muted-foreground" />;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm font-medium">{value || '—'}</div>
    </div>
  );
}

function AttachmentRow({ attachment }: { attachment: CarteiraDetailAttachment }) {
  return (
    <a
      href={attachment.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
    >
      <FileIcon fileType={attachment.fileType} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.fileSize)}
          {attachment.uploaderName && ` · ${attachment.uploaderName}`}
          {' · '}{formatDate(attachment.uploadedAt)}
        </p>
      </div>
      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

interface EditDependent {
  _key: string;
  id?: string;
  name: string;
  birthDate: string;
  parentesco: string;
  document: string;
}

interface EditForm {
  operadora: string;
  productName: string;
  amount: string;
  startDateAt: string;
  contractDueDate: string;
  notes: string;
  holderEnabled: boolean;
  holderName: string;
  holderBirthDate: string;
  holderDocument: string;
  holderCnpj: string;
  dependents: EditDependent[];
}

function initEditForm(detail: CarteiraDetailData): EditForm {
  return {
    operadora: detail.contract?.operadora ?? '',
    productName: detail.contract?.productName ?? detail.soldPlan ?? '',
    amount: detail.contract ? formatCurrencyInput(detail.contract.amount) : '',
    startDateAt: toInputDate(detail.contract?.startDateAt),
    contractDueDate: toInputDate(detail.contractDueDate),
    notes: detail.contract?.notes ?? '',
    holderEnabled: !!detail.holder,
    holderName: detail.holder?.name ?? '',
    holderBirthDate: toInputDate(detail.holder?.birthDate),
    holderDocument: detail.holder?.document ?? '',
    holderCnpj: detail.holder?.cnpj ?? '',
    dependents: detail.dependents.map((d) => ({
      _key: d.id,
      id: d.id,
      name: d.name,
      birthDate: toInputDate(d.birthDate),
      parentesco: d.parentesco,
      document: d.document ?? '',
    })),
  };
}

function buildPayload(form: EditForm): UpdateCarteiraDetailPayload {
  const holderDocument = sanitizeRgCpfDigits(form.holderDocument);
  const hasHolderContent =
    !!form.holderName.trim() ||
    !!form.holderBirthDate ||
    !!holderDocument ||
    !!form.holderCnpj.trim();

  return {
    operadora: form.operadora.trim() || null,
    productName: form.productName.trim() || null,
    amount: parseCurrencyInput(form.amount) || undefined,
    startDateAt: form.startDateAt || undefined,
    contractDueDate: form.contractDueDate || null,
    soldPlan: form.productName.trim() || null,
    notes: form.notes.trim() || null,
    holder: (form.holderEnabled || hasHolderContent)
      ? {
          name: form.holderName.trim(),
          birthDate: form.holderBirthDate,
          document: holderDocument,
          cnpj: form.holderCnpj.trim() || null,
        }
      : undefined,
    dependents: form.dependents.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      birthDate: d.birthDate,
      parentesco: d.parentesco,
      document: d.document ? sanitizeRgCpfDigits(d.document) : null,
    })),
  };
}

interface CarteiraDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CarteiraDetailData | null;
  isLoading: boolean;
  onSave: (leadId: string, payload: UpdateCarteiraDetailPayload) => Promise<void>;
}

export function CarteiraDetailModal({
  open,
  onOpenChange,
  detail,
  isLoading,
  onSave,
}: CarteiraDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const startEditing = useCallback(() => {
    if (!detail) return;
    setForm(initEditForm(detail));
    setIsEditing(true);
  }, [detail]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setForm(null);
  }, []);

  const handleSave = async () => {
    if (!detail || !form) return;
    setIsSaving(true);
    try {
      await onSave(detail.leadId, buildPayload(form));
      setIsEditing(false);
      setForm(null);
      toast.success('Dados atualizados com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const patchForm = useCallback(<K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }, []);

  const addDependent = () => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dependents: [
          ...prev.dependents,
          { _key: crypto.randomUUID(), name: '', birthDate: '', parentesco: '', document: '' },
        ],
      };
    });
  };

  const removeDependent = (key: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      return { ...prev, dependents: prev.dependents.filter((d) => d._key !== key) };
    });
  };

  const patchDependent = (key: string, patch: Partial<Omit<EditDependent, '_key'>>) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dependents: prev.dependents.map((d) => d._key === key ? { ...d, ...patch } : d),
      };
    });
  };

  const handleClose = () => {
    if (isEditing) cancelEditing();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          {isLoading ? (
            <>
              <DialogTitle className="sr-only">Carregando...</DialogTitle>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-4 w-24" />
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <DialogTitle>{detail?.leadName ?? '—'}</DialogTitle>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <DialogDescription asChild>
                  <span className="text-sm text-muted-foreground">{detail?.leadCode}</span>
                </DialogDescription>
                {detail?.portfolioStatus && (
                  <Badge variant={STATUS_BADGE_VARIANT[detail.portfolioStatus]} className="text-xs">
                    {PORTFOLIO_STATUS_LABELS[detail.portfolioStatus]}
                  </Badge>
                )}
              </div>
            </>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Contrato */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">Contrato</h3>
            <Separator className="mb-4" />
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : !detail?.contract ? (
              <p className="text-sm text-muted-foreground">Contrato não encontrado.</p>
            ) : isEditing && form ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Operadora</Label>
                  <Input value={form.operadora} onChange={(e) => patchForm('operadora', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Plano</Label>
                  <Input value={form.productName} onChange={(e) => patchForm('productName', e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input value={form.amount} onChange={(e) => patchForm('amount', e.target.value)} className="h-8 text-sm" placeholder="0,00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <DateTimePicker
                    date={toPickerDate(form.contractDueDate)}
                    onDateChange={(value) => patchForm('contractDueDate', fromPickerDate(value))}
                    label="Vencimento"
                    showTime={false}
                    disablePastDates={false}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <DateTimePicker
                    date={toPickerDate(form.startDateAt)}
                    onDateChange={(value) => patchForm('startDateAt', fromPickerDate(value))}
                    label="Data de início"
                    showTime={false}
                    disablePastDates={false}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => patchForm('notes', e.target.value)} className="min-h-16 resize-none text-sm" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Operadora" value={detail.contract.operadora} />
                <InfoRow label="Plano" value={detail.contract.productName ?? detail.soldPlan} />
                <InfoRow label="Valor" value={formatBRL(detail.contract.amount)} />
                <InfoRow label="Vencimento" value={formatDate(detail.contractDueDate)} />
                <InfoRow label="Data de início" value={formatDate(detail.contract.startDateAt)} />
                <InfoRow label="SDR" value={<ProfileBadge person={detail.sdr} />} />
                <InfoRow label="Closer" value={<ProfileBadge person={detail.closer} />} />
                {detail.contract.notes && (
                  <div className="col-span-2">
                    <InfoRow label="Observações" value={detail.contract.notes} />
                  </div>
                )}
                {detail.contract.contractFileUrl && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">Arquivo do contrato</span>
                    <div className="mt-0.5">
                      <a
                        href={detail.contract.contractFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Ver contrato <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Titular */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">Titular</h3>
            <Separator className="mb-4" />
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : isEditing && form ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <Label className="text-xs">Nome completo</Label>
                    <Input value={form.holderName} onChange={(e) => patchForm('holderName', e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <DateTimePicker
                      date={toPickerDate(form.holderBirthDate)}
                      onDateChange={(value) => patchForm('holderBirthDate', fromPickerDate(value))}
                      label="Data de nascimento"
                      showTime={false}
                      disablePastDates={false}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">CPF</Label>
                    <Input
                      value={formatRgCpfInput(form.holderDocument)}
                      onChange={(e) => patchForm('holderDocument', sanitizeRgCpfDigits(e.target.value))}
                      className="h-8 text-sm"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">CNPJ (opcional)</Label>
                    <Input value={form.holderCnpj} onChange={(e) => patchForm('holderCnpj', e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            ) : !detail?.holder ? (
              <p className="text-sm text-muted-foreground">Titular não cadastrado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <InfoRow label="Nome" value={detail.holder.name} />
                </div>
                <InfoRow label="Data de nascimento" value={formatDate(detail.holder.birthDate)} />
                <InfoRow label="CPF" value={formatRgCpfInput(detail.holder.document)} />
                {detail.holder.cnpj && (
                  <InfoRow label="CNPJ" value={formatDocumentInput(detail.holder.cnpj)} />
                )}
              </div>
            )}
          </section>

          {/* Dependentes */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Dependentes</h3>
              {isEditing && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addDependent}>
                  <Plus className="mr-1 size-3.5" />
                  Adicionar
                </Button>
              )}
            </div>
            <Separator className="mb-4" />
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : isEditing && form ? (
              form.dependents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dependente. Clique em Adicionar.</p>
              ) : (
                <div className="space-y-3">
                  {form.dependents.map((dep) => (
                    <div key={dep._key} className="rounded-md border p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 flex items-start gap-2">
                          <div className="flex-1 flex flex-col gap-1.5">
                            <Label className="text-xs">Nome</Label>
                            <Input
                              value={dep.name}
                              onChange={(e) => patchDependent(dep._key, { name: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="Nome completo"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mt-5 size-8 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => removeDependent(dep._key)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <DateTimePicker
                            date={toPickerDate(dep.birthDate)}
                            onDateChange={(value) =>
                              patchDependent(dep._key, { birthDate: fromPickerDate(value) })
                            }
                            label="Nascimento"
                            showTime={false}
                            disablePastDates={false}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs">Parentesco</Label>
                          <Select value={dep.parentesco} onValueChange={(v) => patchDependent(dep._key, { parentesco: v })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {PARENTESCO_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <Label className="text-xs">Documento (CPF/RG)</Label>
                          <Input
                            value={formatRgCpfInput(dep.document)}
                            onChange={(e) => patchDependent(dep._key, { document: sanitizeRgCpfDigits(e.target.value) })}
                            className="h-8 text-sm"
                            placeholder="Opcional"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : !detail?.dependents?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum dependente cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {detail.dependents.map((dep) => (
                  <div key={dep.id} className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3">
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-sm font-medium">{dep.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{dep.parentesco}</Badge>
                    </div>
                    <InfoRow label="Nascimento" value={formatDate(dep.birthDate)} />
                    {dep.document && (
                      <InfoRow label="Documento" value={formatRgCpfInput(dep.document)} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Documentos */}
          <section>
            <h3 className="mb-3 text-sm font-semibold">Documentos</h3>
            <Separator className="mb-4" />
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-md" />
                ))}
              </div>
            ) : !detail?.attachments?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
            ) : (
              <div className="space-y-2">
                {detail.attachments.map((attachment) => (
                  <AttachmentRow key={attachment.id} attachment={attachment} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancelEditing} disabled={isSaving}>
                <X className="mr-1.5 size-3.5" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </>
          ) : (
            <>
              {detail?.contract && (
                <Button variant="outline" onClick={startEditing}>
                  <Pencil className="mr-1.5 size-3.5" />
                  Editar
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
