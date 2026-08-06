"use client";

import { useContext } from "react";
import { DocumentRequestContext } from "./DocumentRequestContext";
import type { DocumentRequestContextValue } from "./DocumentRequestTypes";

export function useDocumentRequestContext(): DocumentRequestContextValue {
  const ctx = useContext(DocumentRequestContext);
  if (!ctx) {
    throw new Error("useDocumentRequestContext deve ser usado dentro de DocumentRequestProvider");
  }
  return ctx;
}
