#!/usr/bin/env bun
/**
 * Reads forge build artifacts for the pinned template contracts and writes a
 * deterministic keccak256(runtimeBytecode) snapshot to
 * `packages/codegen/src/bytecode-hashes.json`. The codegen pipeline embeds
 * those hashes in every generated `manifest.json` so a partner can confirm
 * the artifact they're about to deploy matches the one CI built and tested.
 *
 * Run after `forge build`. CI re-runs this and asserts no diff against the
 * committed snapshot, so any change to template Solidity or solc version
 * (currently 0.8.23) forces a refresh.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { keccak256 } from "viem";

const ROOT = join(import.meta.dir, "..", "..", "..");
const OUT_DIR = join(ROOT, "packages/contracts/out");
const TARGET = join(ROOT, "packages/codegen/src/bytecode-hashes.json");

const TEMPLATES = [
  { id: "stop-loss", artifact: "StopLossStrategy.sol/StopLossStrategy.json" },
  { id: "gas-guard", artifact: "GasGuardStrategy.sol/GasGuardStrategy.json" },
  { id: "twap-slice", artifact: "TwapSliceGetter.sol/TwapSliceGetter.json" },
  {
    id: "dca-schedule",
    artifact: "DcaSeriesRegistry.sol/DcaSeriesRegistry.json",
  },
] as const;

interface ForgeArtifact {
  deployedBytecode: { object: `0x${string}` };
}

const result: Record<string, { compiler: string; bytecodeHash: string }> = {};
for (const { id, artifact } of TEMPLATES) {
  const path = join(OUT_DIR, artifact);
  if (!existsSync(path)) {
    console.error(`[snapshot-bytecode] missing: ${path}`);
    console.error(
      "[snapshot-bytecode] run `forge build` in packages/contracts first.",
    );
    process.exit(1);
  }
  const json = JSON.parse(readFileSync(path, "utf8")) as ForgeArtifact;
  const runtime = json.deployedBytecode.object;
  if (!runtime || runtime === "0x") {
    console.error(
      `[snapshot-bytecode] empty runtime bytecode for ${id} (${path})`,
    );
    process.exit(1);
  }
  result[id] = {
    compiler: "0.8.23",
    bytecodeHash: keccak256(runtime),
  };
}

writeFileSync(TARGET, `${JSON.stringify(result, null, 2)}\n`);
console.log(`[snapshot-bytecode] wrote ${TARGET}`);
for (const [id, entry] of Object.entries(result)) {
  console.log(`  ${id} → ${entry.bytecodeHash}`);
}
