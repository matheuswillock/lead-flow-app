"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { documentRequestService } from "../services/DocumentRequestService";
import type {
  DocumentRequestContextValue,
  DocumentRequestData,
} from "./DocumentRequestTypes";

export const DocumentRequestContext = createContext<DocumentRequestContextValue | null>(null);

interface DocumentRequestProviderProps {
  token: string;
  children: ReactNode;
}

export function DocumentRequestProvider({ token, children }: DocumentRequestProviderProps) {
  const [request, setRequest] = useState<DocumentRequestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const lastSuccessKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    if (inFlightRef.current) return;
    if (lastSuccessKeyRef.current === token) return;

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    void documentRequestService
      .getByToken(token)
      .then((data) => {
        setRequest(data);
        lastSuccessKeyRef.current = token;
      })
      .catch((err: unknown) => {
        console.error("[DocumentRequestProvider] Erro ao carregar:", err);
        setRequest(null);
        setError(err instanceof Error ? err.message : "Solicitação não encontrada");
      })
      .finally(() => {
        inFlightRef.current = false;
        setIsLoading(false);
      });
  }, [token]);

  const markItemUploaded = useCallback((itemId: string, uploadedAt: string) => {
    setRequest((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, uploadedAt } : item
        ),
      };
    });
  }, []);

  const uploadItem = useCallback(
    async (itemId: string, file: File) => {
      try {
        await documentRequestService.uploadItem(token, itemId, file);
        markItemUploaded(itemId, new Date().toISOString());
        toast.success("Documento enviado com sucesso");
        return true;
      } catch (err) {
        console.error("[DocumentRequestProvider] Erro no upload:", err);
        toast.error(err instanceof Error ? err.message : "Não foi possível enviar o arquivo");
        return false;
      }
    },
    [markItemUploaded, token]
  );

  const value = useMemo<DocumentRequestContextValue>(
    () => ({
      token,
      request,
      isLoading,
      error,
      markItemUploaded,
      uploadItem,
    }),
    [token, request, isLoading, error, markItemUploaded, uploadItem]
  );

  return (
    <DocumentRequestContext.Provider value={value}>
      {children}
    </DocumentRequestContext.Provider>
  );
}
