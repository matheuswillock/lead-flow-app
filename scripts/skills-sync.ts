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

// Quote a value for a YAML double-quoted scalar so descriptions containing
// `: `, `#`, or other YAML-significant characters stay valid frontmatter.
function yamlDoubleQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function renderCursorAdapter(
  description: string,
  sourceName: string,
  body: string,
): string {
  return [
    "---",
    `description: ${yamlDoubleQuote(description)}`,
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
    `description: ${yamlDoubleQuote(description)}`,
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

interface SkillSource {
  // Skill identifier used to name the generated adapters.
  baseName: string;
  // Absolute path to the canonical skill content.
  sourcePath: string;
  // Stable label used in the generated-file header comment.
  sourceLabel: string;
}

async function syncSkills(): Promise<void> {
  let entries: SkillSource[];
  try {
    const dirents = await fs.readdir(SKILLS_SOURCE_DIR, {
      withFileTypes: true,
    });

    // Two canonical layouts are supported:
    //   - flat file:   .claude/skills/<name>.md
    //   - folder skill: .claude/skills/<name>/SKILL.md (also loaded natively
    //     by Claude Code as a skill)
    const flat: SkillSource[] = dirents
      .filter((d) => d.isFile() && d.name.endsWith(".md"))
      .map((d) => ({
        baseName: d.name.replace(/\.md$/, ""),
        sourcePath: path.join(SKILLS_SOURCE_DIR, d.name),
        sourceLabel: d.name,
      }));

    const folders: SkillSource[] = [];
    for (const d of dirents.filter((d) => d.isDirectory())) {
      const skillPath = path.join(SKILLS_SOURCE_DIR, d.name, "SKILL.md");
      try {
        await fs.access(skillPath);
        folders.push({
          baseName: d.name,
          sourcePath: skillPath,
          sourceLabel: `${d.name}/SKILL.md`,
        });
      } catch {
        // directory without a SKILL.md — not a skill source
      }
    }

    entries = [...flat, ...folders].sort((a, b) =>
      a.baseName.localeCompare(b.baseName),
    );
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

  for (const { baseName, sourcePath, sourceLabel } of entries) {
    const rawContent = await fs.readFile(sourcePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(rawContent);

    const description = frontmatter.description ?? baseName;

    // Cursor adapter
    const cursorPath = path.join(CURSOR_SKILLS_DIR, `${baseName}.mdc`);
    await writeIfChanged(
      cursorPath,
      renderCursorAdapter(description, sourceLabel, body),
      `.cursor/skills/${baseName}.mdc`,
    );

    // Copilot adapter
    const copilotPath = path.join(
      COPILOT_PROMPTS_DIR,
      `${baseName}.prompt.md`,
    );
    await writeIfChanged(
      copilotPath,
      renderCopilotAdapter(description, sourceLabel, body),
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
