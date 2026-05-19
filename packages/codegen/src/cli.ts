#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  getTemplateCatalogEntry,
  parseStrategyDocument,
} from "@limit-canvas/hook-dsl";
import { generateArtifacts } from "./generate.js";

const MAINNET_ELIGIBLE_MATURITIES = new Set(["audit-ready", "mainnet-enabled"]);

const inputPath = process.argv[2];
const outDir = resolve(process.argv[3] ?? "./artifacts");

if (!inputPath) {
  console.error("Usage: lop-codegen <strategy.json> [outDir]");
  process.exit(1);
}

const raw = await Bun.file(inputPath).json();
const doc = parseStrategyDocument(raw);

if (process.env.FOUNDRY_PROFILE === "mainnet") {
  const entry = getTemplateCatalogEntry(doc.templateId);
  if (!entry || !MAINNET_ELIGIBLE_MATURITIES.has(entry.maturity)) {
    console.error(
      `Refusing mainnet codegen: template "${doc.templateId}" maturity is "${entry?.maturity ?? "unknown"}". Mainnet requires "audit-ready" or "mainnet-enabled".`,
    );
    process.exit(1);
  }
  if (!doc.audited) {
    console.error(
      "Refusing mainnet codegen: set audited: true in DSL to attest that this strategy instance has been reviewed.",
    );
    process.exit(1);
  }
}

const result = generateArtifacts(doc);
mkdirSync(outDir, { recursive: true });

for (const art of result.artifacts) {
  const full = join(outDir, art.relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, art.content);
}

console.log(`Generated ${result.artifacts.length} files → ${outDir}`);
console.log("Extension hash:", result.extensionHash);
