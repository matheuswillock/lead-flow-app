"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AssociateProposalRow } from "../context/AssociadosTypes";
import { DOCUMENT_TYPE_LABELS } from "../context/AssociadosTypes";
import { useAssociadosContext } from "../context/AssociadosContext";

type AssociadoLeadDrawerProps = {
  row: AssociateProposalRow | null;
};

export function AssociadoLeadDrawer({ row }: AssociadoLeadDrawerProps) {
  const {
    drawerOpen,
    closeDrawer,
    detail,
    detailLoading,
    detailError,
    leadAttachments,
    reloadDetail,
    criticize,
    registerSale,
    approveDocument,
    rejectDocument,
    linkDocument,
    uploadPaymentProof,
  } = useAssociadosContext();

  const [criticizeOpen, setCriticizeOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectDocType, setRejectDocType] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [criticizeTitle, setCriticizeTitle] = useState("");
  const [criticizeMessage, setCriticizeMessage] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [paymentAttachmentId, setPaymentAttachmentId] = useState("");
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const reviewStatus = detail?.proposalReview?.status ?? row?.reviewStatus;
  const isCriticized = reviewStatus === "criticized";

  async function runMutation(action: () => Promise<void>, successMessage: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await action();
      toast.success(successMessage);
    } catch (err) {
      toastUserError(err);
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      <Sheet open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent className="flex w-full flex-col sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{row?.leadName ?? detail?.name ?? "Detalhe"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {detailLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : detailError ? (
              <div className="flex flex-col gap-2">
                <p className="text-destructive text-sm">{detailError}</p>
                <Button variant="outline" size="sm" onClick={() => void reloadDetail()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Conta:</span>{" "}
                    {row?.associateAccountName ?? detail?.team?.master.fullName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Time:</span>{" "}
                    {row?.teamName ?? detail?.team?.name}
                  </p>
                  {isCriticized ? (
                    <Badge variant="destructive" className="mt-2 w-fit">
                      Proposta criticada
                    </Badge>
                  ) : null}
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Documentos obrigatórios</h3>
                  {(detail?.requiredDocuments ?? []).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col gap-2 rounded-md border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {DOCUMENT_TYPE_LABELS[doc.documentType]}
                        </span>
                        <Badge variant="outline">{doc.status}</Badge>
                      </div>
                      {doc.attachment?.fileName ? (
                        <p className="text-muted-foreground text-xs">{doc.attachment.fileName}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={linkSelections[doc.documentType] ?? ""}
                          onValueChange={(value) =>
                            setLinkSelections((prev) => ({ ...prev, [doc.documentType]: value }))
                          }
                        >
                          <SelectTrigger className="min-w-[180px]">
                            <SelectValue placeholder="Vincular anexo" />
                          </SelectTrigger>
                          <SelectContent>
                            {leadAttachments.map((attachment) => (
                              <SelectItem key={attachment.id} value={attachment.id}>
                                {attachment.fileName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!linkSelections[doc.documentType] || submitting}
                          onClick={() =>
                            void runMutation(
                              () => linkDocument(doc.documentType, linkSelections[doc.documentType]!),
                              "Documento vinculado"
                            )
                          }
                        >
                          Vincular
                        </Button>
                        <Button
                          size="sm"
                          disabled={submitting}
                          onClick={() =>
                            void runMutation(
                              () => approveDocument(doc.documentType),
                              "Documento aprovado"
                            )
                          }
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => {
                            setRejectDocType(doc.documentType);
                            setRejectOpen(true);
                          }}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {detail?.status === "invoicePayment" ? (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium">Comprovante de boleto</h3>
                      <Select value={paymentAttachmentId} onValueChange={setPaymentAttachmentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o anexo" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadAttachments.map((attachment) => (
                            <SelectItem key={attachment.id} value={attachment.id}>
                              {attachment.fileName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={!paymentAttachmentId || submitting}
                        onClick={() =>
                          void runMutation(
                            () => uploadPaymentProof(paymentAttachmentId),
                            "Comprovante registrado"
                          )
                        }
                      >
                        Registrar comprovante
                      </Button>
                    </div>
                  </>
                ) : null}

                <Separator />

                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Histórico recente</h3>
                  <div className="flex flex-col gap-2">
                    {(detail?.activities ?? []).slice(0, 8).map((activity) => (
                      <div key={activity.id} className="rounded-md border p-2 text-xs">
                        <p className="text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString("pt-BR")}
                        </p>
                        <p>{activity.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t p-4">
            <Button disabled={submitting} onClick={() => setRegisterOpen(true)}>
              Registrar venda
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isCriticized || submitting}
                    onClick={() => setCriticizeOpen(true)}
                  >
                    Criticar proposta
                  </Button>
                </span>
              </TooltipTrigger>
              {isCriticized ? (
                <TooltipContent>Esta proposta já foi criticada</TooltipContent>
              ) : null}
            </Tooltip>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={criticizeOpen} onOpenChange={submitting ? undefined : setCriticizeOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criticar proposta</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="criticize-title">Título</FieldLabel>
                <Input
                  id="criticize-title"
                  value={criticizeTitle}
                  onChange={(e) => setCriticizeTitle(e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="criticize-message">Mensagem</FieldLabel>
                <Textarea
                  id="criticize-message"
                  value={criticizeMessage}
                  onChange={(e) => setCriticizeMessage(e.target.value)}
                  disabled={submitting}
                  rows={6}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setCriticizeOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={submitting || criticizeTitle.length < 3 || criticizeMessage.length < 10}
              onClick={() =>
                void runMutation(async () => {
                  await criticize({ title: criticizeTitle, message: criticizeMessage });
                  setCriticizeOpen(false);
                  setCriticizeTitle("");
                  setCriticizeMessage("");
                }, "Proposta criticada")
              }
            >
              {submitting ? "Enviando..." : "Confirmar crítica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={registerOpen} onOpenChange={submitting ? undefined : setRegisterOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar venda</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="operator-name">Operadora</FieldLabel>
                <Input
                  id="operator-name"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="proposal-number">Número da proposta</FieldLabel>
                <Input
                  id="proposal-number"
                  value={proposalNumber}
                  onChange={(e) => setProposalNumber(e.target.value)}
                  disabled={submitting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sale-notes">Observações</FieldLabel>
                <Textarea
                  id="sale-notes"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  disabled={submitting}
                  rows={4}
                />
              </Field>
              {leadAttachments.length > 0 ? (
                <Field>
                  <FieldLabel>Anexos de confirmação</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {leadAttachments.map((attachment) => {
                      const checked = selectedAttachmentIds.includes(attachment.id);
                      return (
                        <label key={attachment.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedAttachmentIds((prev) =>
                                e.target.checked
                                  ? [...prev, attachment.id]
                                  : prev.filter((id) => id !== attachment.id)
                              );
                            }}
                          />
                          {attachment.fileName}
                        </label>
                      );
                    })}
                  </div>
                </Field>
              ) : null}
            </FieldGroup>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setRegisterOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              disabled={submitting || operatorName.trim().length < 2}
              onClick={() =>
                void runMutation(async () => {
                  await registerSale({
                    operatorName: operatorName.trim(),
                    proposalNumber: proposalNumber.trim() || undefined,
                    notes: saleNotes.trim() || undefined,
                    attachmentIds: selectedAttachmentIds.length ? selectedAttachmentIds : undefined,
                  });
                  setRegisterOpen(false);
                  setOperatorName("");
                  setProposalNumber("");
                  setSaleNotes("");
                  setSelectedAttachmentIds([]);
                }, "Venda registrada")
              }
            >
              {submitting ? "Salvando..." : "Registrar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={submitting ? undefined : setRejectOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rejeitar documento</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="reject-reason">Motivo</FieldLabel>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                disabled={submitting}
                rows={4}
              />
            </Field>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={submitting || rejectReason.length < 5 || !rejectDocType}
              onClick={() =>
                void runMutation(async () => {
                  await rejectDocument(
                    rejectDocType as keyof typeof DOCUMENT_TYPE_LABELS,
                    rejectReason
                  );
                  setRejectOpen(false);
                  setRejectReason("");
                  setRejectDocType(null);
                }, "Documento rejeitado")
              }
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
