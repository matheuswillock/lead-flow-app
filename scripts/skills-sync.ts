#!/usr/bin/env bun

/**
 * skills-sync.ts
 *
 * Reads canonical skill definitions from .claude/skills/*.md and generates
 * platform adapters for Cursor and GitHub Copilot.
 *
 * Usage:
 *   bun run skills:sync
 *
 * Canonical source:  .claude/skills/*.md
 * Cursor adapter:    .cursor/skills/<name>.mdc
 * Copilot adapter:   .github/prompts/<name>.prompt.md
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKILLS_SOURCE_DIR = path.join(ROOT, ".claude", "skills");
const CURSOR_SKILLS_DIR = path.join(ROOT, ".cursor", "skills");
const COPILOT_PROMPTS_DIR = path.join(ROOT, ".github", "prompts");

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface SkillFrontmatter {
  description?: string;
}

function parseFrontmatter(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    return { frontmatter: {}, body: content };
  }

  const rawFm = fmMatch[1] ?? "";
  const body = fmMatch[2] ?? "";
  const frontmatter: SkillFrontmatter = {};

  for (const line of rawFm.split("\n")) {
    const match = line.match(/^(\w+)\s*:\s*['"]?(.*?)['"]?\s*$/);
    if (match) {
      const key = match[1] as keyof SkillFrontmatter;
      frontmatter[key] = match[2];
    }
  }

  return { frontmatter, body };
}

// ---------------------------------------------------------------------------
// Adapter renderers
// ---------------------------------------------------------------------------

function renderGeneratedHeader(sourceName: string): string {
  return [
    "<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->",
    `<!-- Source: .claude/skills/${sourceName} -->`,
    "<!-- Regenerate with: bun run skills:sync -->",
    "",
  ].join("\n");
}

function renderCursorAdapter(
  description: string,
  sourceName: string,
  body: string,
): string {
  return [
    "---",
    `description: ${description}`,
    "alwaysApply: false",
    "---",
    "",
    renderGeneratedHeader(sourceName),
    body.trimEnd(),
    "",
  ].join("\n");
}

function renderCopilotAdapter(
  description: string,
  sourceName: string,
  body: string,
): string {
  return [
    "---",
    "mode: 'agent'",
    `description: '${description.replace(/'/g, "\\'")}'`,
    "---",
    "",
    renderGeneratedHeader(sourceName),
    body.trimEnd(),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeIfChanged(
  targetPath: string,
  content: string,
  label: string,
): Promise<void> {
  let existing: string | null = null;
  try {
    existing = await fs.readFile(targetPath, "utf8");
  } catch {
    // file does not exist yet
  }

  if (existing === content) {
    console.info("[skills:sync] Unchanged", label);
    return;
  }

  await fs.writeFile(targetPath, content, "utf8");
  console.info("[skills:sync] Updated ", label);
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

async function syncSkills(): Promise<void> {
  let entries: string[];
  try {
    const dirents = await fs.readdir(SKILLS_SOURCE_DIR, {
      withFileTypes: true,
    });
    entries = dirents
      .filter((d) => d.isFile() && d.name.endsWith(".md"))
      .map((d) => d.name)
      .sort();
  } catch {
    console.error(
      "[skills:sync] ERROR: could not read",
      SKILLS_SOURCE_DIR,
      "— make sure .claude/skills/ exists.",
    );
    process.exit(1);
  }

  if (entries.length === 0) {
    console.info("[skills:sync] No skill files found in .claude/skills/");
    return;
  }

  await ensureDir(CURSOR_SKILLS_DIR);
  await ensureDir(COPILOT_PROMPTS_DIR);

  for (const filename of entries) {
    const sourcePath = path.join(SKILLS_SOURCE_DIR, filename);
    const rawContent = await fs.readFile(sourcePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(rawContent);

    const description = frontmatter.description ?? filename.replace(".md", "");
    const baseName = filename.replace(/\.md$/, "");

    // Cursor adapter
    const cursorPath = path.join(CURSOR_SKILLS_DIR, `${baseName}.mdc`);
    await writeIfChanged(
      cursorPath,
      renderCursorAdapter(description, filename, body),
      `.cursor/skills/${baseName}.mdc`,
    );

    // Copilot adapter
    const copilotPath = path.join(
      COPILOT_PROMPTS_DIR,
      `${baseName}.prompt.md`,
    );
    await writeIfChanged(
      copilotPath,
      renderCopilotAdapter(description, filename, body),
      `.github/prompts/${baseName}.prompt.md`,
    );
  }

  console.info(
    `[skills:sync] Done — ${entries.length} skill(s) processed.`,
  );
}

syncSkills().catch((err: unknown) => {
  console.error("[skills:sync] Unexpected error:", err);
  process.exit(1);
});
