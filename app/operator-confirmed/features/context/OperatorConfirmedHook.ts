"use client";

import { useOperatorConfirmedContext } from "./OperatorConfirmedContext";

export function useOperatorConfirmed() {
  return useOperatorConfirmedContext();
}
