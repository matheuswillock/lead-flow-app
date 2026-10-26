"use client";

import { useEffect } from "react";
import { installClientErrorReporter } from "@/lib/observability/client-reporter";

export function ClientErrorReporter() {
  useEffect(() => installClientErrorReporter(), []);
  return null;
}
