#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

interface CliArgs {
  [key: string]: string | boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    i += 1;
  }
  return result;
}

function toKebab(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

function toPascal(input: string): string {
  return input
    .split("-")
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

function toCamel(input: string): string {
  const pascal = toPascal(input);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeNewFile(relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(ROOT, ...relativePath.split("/"));
  if (await fileExists(absolutePath)) {
    throw new Error(`File already exists: ${relativePath}`);
  }
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

function getBackendTemplates({
  featureKebab,
  featureCamel,
  featurePascal,
}: {
  featureKebab: string;
  featureCamel: string;
  featurePascal: string;
}): Record<string, string> {
  return {
    [`app/api/useCases/${featureCamel}/I${featurePascal}UseCase.ts`]: `import { Output } from "@/lib/output";

export interface I${featurePascal}UseCase {
  execute(input: { supabaseId: string }): Promise<Output>;
}
`,
    [`app/api/useCases/${featureCamel}/${featurePascal}UseCase.ts`]: `import { Output } from "@/lib/output";
import type { I${featurePascal}UseCase } from "./I${featurePascal}UseCase";
import type { I${featurePascal}Service } from "@/app/api/services/${featurePascal}/I${featurePascal}Service";

export class ${featurePascal}UseCase implements I${featurePascal}UseCase {
  constructor(private ${featureCamel}Service: I${featurePascal}Service) {}

  async execute(input: { supabaseId: string }): Promise<Output> {
    try {
      if (!input.supabaseId) {
        return new Output(false, [], ["supabaseId is required"], null);
      }

      const result = await this.${featureCamel}Service.execute(input);
      return new Output(true, ["Success"], [], result);
    } catch (error) {
      console.error("[${featurePascal}UseCase] Error:", error);
      return new Output(false, [], ["Internal server error"], null);
    }
  }
}
`,
    [`app/api/services/${featurePascal}/I${featurePascal}Service.ts`]: `export interface I${featurePascal}Service {
  execute(input: { supabaseId: string }): Promise<unknown>;
}
`,
    [`app/api/services/${featurePascal}/${featurePascal}Service.ts`]: `import type { I${featurePascal}Service } from "./I${featurePascal}Service";

export class ${featurePascal}Service implements I${featurePascal}Service {
  async execute(input: { supabaseId: string }): Promise<unknown> {
    console.info("[${featurePascal}Service] Executing feature logic", input);
    return { supabaseId: input.supabaseId };
  }
}
`,
    [`app/api/v1/${featureKebab}/route.ts`]: `import { NextRequest, NextResponse } from "next/server";
import { ${featurePascal}Service } from "@/app/api/services/${featurePascal}/${featurePascal}Service";
import { ${featurePascal}UseCase } from "@/app/api/useCases/${featureCamel}/${featurePascal}UseCase";

const ${featureCamel}Service = new ${featurePascal}Service();
const ${featureCamel}UseCase = new ${featurePascal}UseCase(${featureCamel}Service);

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id") ?? "";
    const result = await ${featureCamel}UseCase.execute({ supabaseId });
    const status = result.isValid ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("[GET /api/v1/${featureKebab}] Unexpected error:", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ["Unexpected server error"],
        result: null,
      },
      { status: 500 },
    );
  }
}
`,
  };
}

function getFrontendTemplates({
  featureKebab,
  featurePascal,
}: {
  featureKebab: string;
  featurePascal: string;
}): Record<string, string> {
  return {
    [`app/[supabaseId]/${featureKebab}/page.tsx`]: `'use client';

import { ${featurePascal}Provider } from "./features/context/${featurePascal}Context";
import { ${featurePascal}Container } from "./features/container/${featurePascal}Container";

export default function ${featurePascal}Page() {
  return (
    <${featurePascal}Provider>
      <${featurePascal}Container />
    </${featurePascal}Provider>
  );
}
`,
    [`app/[supabaseId]/${featureKebab}/features/context/${featurePascal}Types.ts`]: `export interface I${featurePascal}State {
  isLoading: boolean;
  error: string | null;
}

export interface I${featurePascal}Actions {
  load: () => Promise<void>;
}

export interface I${featurePascal}Context extends I${featurePascal}State, I${featurePascal}Actions {}
`,
    [`app/[supabaseId]/${featureKebab}/features/context/${featurePascal}Hook.ts`]: `'use client';

import { useCallback, useState } from "react";
import type { I${featurePascal}Actions, I${featurePascal}State } from "./${featurePascal}Types";
import { ${featurePascal}Service } from "../services/${featurePascal}Service";

interface Use${featurePascal}HookProps {
  supabaseId: string;
  service: ${featurePascal}Service;
}

export function use${featurePascal}Hook({
  supabaseId,
  service,
}: Use${featurePascal}HookProps): I${featurePascal}State & I${featurePascal}Actions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await service.getData(supabaseId);
    } catch (loadError) {
      console.error("[use${featurePascal}Hook] Error:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [service, supabaseId]);

  return { isLoading, error, load };
}
`,
    [`app/[supabaseId]/${featureKebab}/features/context/${featurePascal}Context.tsx`]: `'use client';

import { createContext, useContext, type ReactNode } from "react";
import { useParams } from "next/navigation";
import type { I${featurePascal}Context } from "./${featurePascal}Types";
import { use${featurePascal}Hook } from "./${featurePascal}Hook";
import { ${featurePascal}Service } from "../services/${featurePascal}Service";

const ${featurePascal}Context = createContext<I${featurePascal}Context | undefined>(undefined);

export function ${featurePascal}Provider({ children }: { children: ReactNode }) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const service = new ${featurePascal}Service();
  const state = use${featurePascal}Hook({ supabaseId, service });

  return (
    <${featurePascal}Context.Provider value={state}>
      {children}
    </${featurePascal}Context.Provider>
  );
}

export function use${featurePascal}Context(): I${featurePascal}Context {
  const context = useContext(${featurePascal}Context);
  if (!context) {
    throw new Error("use${featurePascal}Context must be used inside ${featurePascal}Provider");
  }
  return context;
}
`,
    [`app/[supabaseId]/${featureKebab}/features/services/I${featurePascal}Service.ts`]: `export interface I${featurePascal}Service {
  getData(supabaseId: string): Promise<unknown>;
}
`,
    [`app/[supabaseId]/${featureKebab}/features/services/${featurePascal}Service.ts`]: `import type { I${featurePascal}Service } from "./I${featurePascal}Service";

export class ${featurePascal}Service implements I${featurePascal}Service {
  async getData(supabaseId: string): Promise<unknown> {
    const response = await fetch("/api/v1/${featureKebab}", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
      },
      cache: "no-store",
    });

    const result = await response.json();
    if (!result.isValid) {
      throw new Error(result.errorMessages?.join(", ") ?? "Request failed");
    }

    return result.result;
  }
}
`,
    [`app/[supabaseId]/${featureKebab}/features/container/${featurePascal}Container.tsx`]: `'use client';

import { useEffect } from "react";
import { use${featurePascal}Context } from "../context/${featurePascal}Context";

export function ${featurePascal}Container() {
  const { isLoading, error, load } = use${featurePascal}Context();

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div>${featurePascal} feature scaffold created successfully.</div>;
}
`,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const featureName = args.name ?? args.feature;

  if (!featureName || typeof featureName !== "string") {
    console.error("Usage: bun run scaffold:feature -- --name <feature-name>");
    process.exit(1);
  }

  const featureKebab = toKebab(featureName);
  if (!featureKebab) {
    console.error("Invalid feature name:", featureName);
    process.exit(1);
  }

  const featurePascal = toPascal(featureKebab);
  const featureCamel = toCamel(featureKebab);

  const backendTemplates = getBackendTemplates({
    featureKebab,
    featureCamel,
    featurePascal,
  });
  const frontendTemplates = getFrontendTemplates({
    featureKebab,
    featurePascal,
  });

  const templates: Record<string, string> = {
    ...backendTemplates,
    ...frontendTemplates,
  };

  const createdFiles: string[] = [];
  for (const [relativePath, content] of Object.entries(templates)) {
    await writeNewFile(relativePath, content);
    createdFiles.push(relativePath);
  }

  console.info(
    `[scaffold:feature] Created ${createdFiles.length} files for "${featureKebab}":`,
  );
  for (const created of createdFiles) {
    console.info(`  - ${created}`);
  }
}

main().catch((error: unknown) => {
  console.error("[scaffold:feature] Failed:", error);
  process.exit(1);
});
