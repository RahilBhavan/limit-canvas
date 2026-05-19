import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { parseStrategyDocument } from "@limit-canvas/hook-dsl";
import { generateArtifacts } from "./generate.js";

const EXAMPLES_DIR = join(import.meta.dir, "../../../examples");

const EXAMPLE_FILES = [
  "stop-loss.json",
  "gas-guard.json",
  "twap-slice.json",
  "dca-schedule.json",
] as const;

describe("example strategies codegen", () => {
  for (const file of EXAMPLE_FILES) {
    test(`${file} generates manifest and extensions`, () => {
      const raw = JSON.parse(
        readFileSync(join(EXAMPLES_DIR, file), "utf8"),
      ) as unknown;
      const doc = parseStrategyDocument(raw);
      const result = generateArtifacts(doc);

      const manifestArtifact = result.artifacts.find(
        (artifact) => artifact.relativePath === "manifest.json",
      );
      expect(manifestArtifact).toBeDefined();

      const manifest = JSON.parse(manifestArtifact?.content ?? "{}") as {
        dslHash: string;
        template: { id: string };
        lop: { version: string };
        extensionHash: string;
      };

      expect(manifest.dslHash).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(manifest.template.id).toBe(doc.templateId);
      expect(manifest.lop.version).toBe("4.3.2");
      expect(manifest.extensionHash).toMatch(/^0x[a-fA-F0-9]{40}$/);

      const extensions = result.artifacts.find(
        (artifact) => artifact.relativePath === "extensions.json",
      );
      expect(extensions).toBeDefined();
    });
  }

  test("stop-loss example produces predicate tree root", () => {
    const raw = JSON.parse(
      readFileSync(join(EXAMPLES_DIR, "stop-loss.json"), "utf8"),
    ) as unknown;
    const doc = parseStrategyDocument(raw);
    const result = generateArtifacts(doc);
    expect(result.predicateTree.root).toMatch(/^0x[a-fA-F0-9]+$/);
  });
});
