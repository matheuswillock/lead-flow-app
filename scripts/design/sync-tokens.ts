#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";

type JsonMap = Record<string, unknown>;
type TokenMap = Record<string, string>;

const ROOT = process.cwd();
const DESIGN_PATH = path.join(ROOT, "DESIGN.md");
const GLOBALS_CSS_PATH = path.join(ROOT, "app", "globals.css");

function parseArgs(argv: string[]): { check: boolean } {
  return { check: argv.includes("--check") };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMarkedSection(markdown: string, markerName: string): string {
  const start = `<!-- ${markerName}:START -->`;
  const end = `<!-- ${markerName}:END -->`;
  const pattern = new RegExp(
    `${escapeRegExp(start)}([\\s\\S]*?)${escapeRegExp(end)}`,
    "m",
  );
  const match = markdown.match(pattern);
  if (!match) {
    throw new Error(`Missing marker block: ${markerName}`);
  }
  return match[1].trim();
}

function parseJsonBlock(markdown: string, markerName: string): JsonMap {
  const section = getMarkedSection(markdown, markerName);
  const codeFenceMatch = section.match(/```json\s*([\s\S]*?)```/m);
  const jsonText = (codeFenceMatch ? codeFenceMatch[1] : section).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid JSON in ${markerName}: ${String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected object JSON in ${markerName}`);
  }

  return parsed as JsonMap;
}

function parseTokenMap(markdown: string, markerName: string): TokenMap {
  const json = parseJsonBlock(markdown, markerName);
  const result: TokenMap = {};

  for (const [key, value] of Object.entries(json)) {
    if (typeof value !== "string") {
      throw new Error(
        `${markerName} key "${key}" must be a string value, received ${typeof value}`,
      );
    }
    result[key] = value;
  }

  return result;
}

function buildThemeInline(themeMap: TokenMap): string {
  const lines = ["@theme inline {"];
  for (const [key, value] of Object.entries(themeMap)) {
    lines.push(`  ${key}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function buildTokenRule(selector: string, tokenMap: TokenMap): string {
  const lines = [`${selector} {`];
  for (const [key, value] of Object.entries(tokenMap)) {
    lines.push(`  ${key}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function replaceManagedBlock(
  cssContent: string,
  markerName: "THEME_INLINE" | "ROOT" | "DARK",
  replacementBody: string,
): string {
  const start = `/* TOKENS:${markerName}:START */`;
  const end = `/* TOKENS:${markerName}:END */`;
  const pattern = new RegExp(
    `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
    "m",
  );

  if (!pattern.test(cssContent)) {
    throw new Error(
      `Missing managed CSS marker pair for TOKENS:${markerName} in app/globals.css`,
    );
  }

  const replacement = `${start}\n${replacementBody.trimEnd()}\n${end}`;
  return cssContent.replace(pattern, replacement);
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const design = await fs.readFile(DESIGN_PATH, "utf8");

  const lightTokens = parseTokenMap(design, "TOKENS:LIGHT");
  const darkTokens = parseTokenMap(design, "TOKENS:DARK");
  const themeInlineMap = parseTokenMap(design, "TOKENS:THEME_INLINE_MAP");

  // Required by contract. Parsed for validation even though not rendered directly.
  parseJsonBlock(design, "TOKENS:SEMANTIC_EXTENSIONS");
  parseJsonBlock(design, "TOKENS:MOTION");

  const themeInlineCss = buildThemeInline(themeInlineMap);
  const rootCss = buildTokenRule(":root", lightTokens);
  const darkCss = buildTokenRule(".dark", darkTokens);

  const currentGlobals = await fs.readFile(GLOBALS_CSS_PATH, "utf8");
  let nextGlobals = replaceManagedBlock(currentGlobals, "THEME_INLINE", themeInlineCss);
  nextGlobals = replaceManagedBlock(nextGlobals, "ROOT", rootCss);
  nextGlobals = replaceManagedBlock(nextGlobals, "DARK", darkCss);

  if (args.check) {
    if (nextGlobals !== currentGlobals) {
      console.error(
        "[design:check] globals.css is out of sync with DESIGN.md. Run: bun run design:sync",
      );
      process.exit(1);
    }
    console.info("[design:check] OK - globals.css matches DESIGN.md");
    return;
  }

  if (nextGlobals === currentGlobals) {
    console.info("[design:sync] No changes needed");
    return;
  }

  await fs.writeFile(GLOBALS_CSS_PATH, nextGlobals, "utf8");
  console.info("[design:sync] Updated app/globals.css from DESIGN.md");
}

run().catch((error: unknown) => {
  console.error("[design:sync] Failed:", error);
  process.exit(1);
});
