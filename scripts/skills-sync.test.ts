import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseFrontmatter,
  renderNativeSkillAdapter,
  removeGeneratedAdapter,
  resolveSkillTargets,
  writeIfChanged,
} from "./skills-sync";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("skills sync", () => {
  test("preserves legacy targets when targets are omitted", () => {
    expect([...resolveSkillTargets()].sort()).toEqual([
      "claude",
      "copilot",
      "cursor",
    ]);
  });

  test("parses explicit shared targets", () => {
    const parsed = parseFrontmatter(
      "---\ndescription: Clean Code\ntargets: claude,codex,manus\n---\nBody",
    );

    expect([...resolveSkillTargets(parsed.frontmatter.targets)].sort()).toEqual([
      "claude",
      "codex",
      "manus",
    ]);
  });

  test("rejects an unknown target", () => {
    expect(() => resolveSkillTargets("claude,unknown")).toThrow(
      "Unknown skill target: unknown",
    );
  });

  test("renders a native SKILL.md adapter", () => {
    const rendered = renderNativeSkillAdapter(
      "clean-code",
      "Clean code checklist",
      "clean-code.md",
      "# Clean Code\n\nChecklist",
    );

    expect(rendered).toContain("name: clean-code");
    expect(rendered).toContain("Source: .claude/skills/clean-code.md");
    expect(rendered).toEndWith("Checklist\n");
  });

  test("does not rewrite an unchanged adapter", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "skills-sync-"));
    temporaryDirectories.push(directory);
    const target = path.join(directory, "SKILL.md");

    expect(await writeIfChanged(target, "same\n", "fixture")).toBe(true);
    expect(await writeIfChanged(target, "same\n", "fixture")).toBe(false);
    expect(await readFile(target, "utf8")).toBe("same\n");
  });

  test("removes an adapter when its target is deselected", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "skills-sync-"));
    temporaryDirectories.push(directory);
    const target = path.join(directory, "SKILL.md");

    await writeIfChanged(target, "generated\n", "fixture");

    expect(await removeGeneratedAdapter(target, "fixture")).toBe(true);
    await expect(readFile(target, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await removeGeneratedAdapter(target, "fixture")).toBe(false);
  });
});
