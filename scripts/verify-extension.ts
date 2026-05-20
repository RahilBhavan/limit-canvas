#!/usr/bin/env bun
/**
 * CLI: validate DSL JSON and print extension hash + warnings.
 * Usage: bun run scripts/verify-extension.ts path/to/strategy.json
 */
import { readFileSync } from "node:fs";
import {
  parseStrategyDocument,
  validateExtensionTraits,
} from "../packages/hook-dsl/src/index.ts";
import {
  computeExtensionHash,
  packPredicateOnlyExtension,
} from "../packages/lop-sdk/src/index.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: bun run scripts/verify-extension.ts <strategy.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
const doc = parseStrategyDocument(raw);
const warnings = validateExtensionTraits(doc);

const extensionHex = packPredicateOnlyExtension(doc.predicateCalldata ?? "0x");
const hash = computeExtensionHash(extensionHex);

console.log("Template:", doc.templateId);
console.log("Extension hash (salt low 160):", hash);
console.log(
  "Extension calldata length:",
  (extensionHex.length - 2) / 2,
  "bytes",
);
if (warnings.length > 0) {
  console.warn("Warnings:");
  for (const w of warnings) console.warn(" -", w);
} else {
  console.log("No trait warnings.");
}
