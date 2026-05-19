"use server";

import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { generateArtifacts } from "@limit-canvas/codegen";
import {
  parseStrategyDocument,
  validateExtensionTraits,
} from "@limit-canvas/hook-dsl";
import {
  computeExtensionHash,
  packPredicateOnlyExtension,
} from "@limit-canvas/lop-sdk";

const execAsync = promisify(exec);

export interface GenerateResult {
  ok: boolean;
  extensionHash?: string;
  extension?: string;
  warnings: string[];
  artifacts?: { path: string; content: string }[];
  error?: string;
}

export async function generateFromDsl(json: string): Promise<GenerateResult> {
  try {
    const raw = JSON.parse(json) as unknown;
    const doc = parseStrategyDocument(raw);
    const result = generateArtifacts(doc);
    const warnings = validateExtensionTraits(result.doc);
    return {
      ok: true,
      extensionHash: result.extensionHash,
      extension: extensionFromArtifacts(result.artifacts),
      warnings,
      artifacts: result.artifacts.map((a) => ({
        path: a.relativePath,
        content: a.content,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      warnings: [],
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function previewExtension(json: string): Promise<{
  hash: string;
  extension: `0x${string}`;
  calldataLength: number;
  tree: string[];
  warnings: string[];
  bytecodeHash: string | null;
}> {
  const doc = parseStrategyDocument(JSON.parse(json));
  const result = generateArtifacts(doc);
  const warnings = validateExtensionTraits(result.doc);
  const artifactExtension = extensionFromArtifacts(result.artifacts);
  const ext = (artifactExtension ?? "0x") as `0x${string}`;
  const hash = computeExtensionHash(ext);
  const tree: string[] = [`Template: ${doc.templateId}`];
  if (doc.block.type === "stop-loss") {
    tree.push(`Predicate → oracle ${doc.block.oracle}`);
    tree.push(`  ${doc.block.direction} ${doc.block.threshold}`);
    tree.push(
      `  staleAfter ${doc.block.staleAfter}s · decimals ${doc.block.decimals}`,
    );
  }
  if (doc.block.type === "gas-guard") {
    tree.push(`Predicate → basefee <= ${doc.block.maxGwei} gwei`);
  }
  if (doc.block.type === "twap-slice") {
    tree.push(
      `Getter → slice ${doc.block.sliceAmount} / ${doc.block.intervalSeconds}s`,
    );
  }
  if (doc.block.type === "dca-schedule") {
    tree.push(`Series → ${doc.block.tranches} tranches`);
  }
  return {
    hash,
    extension: ext,
    calldataLength: (ext.length - 2) / 2,
    tree,
    warnings,
    bytecodeHash: result.bytecodeHash,
  };
}

export interface ProofCheckResult {
  tests: "pass" | "fail";
  fuzz: "pass" | "fail";
  gas: "pass" | "fail";
  output: string;
}

export async function runProofChecks(): Promise<ProofCheckResult> {
  const contractsDir = path.join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "contracts",
  );
  const env = {
    ...process.env,
    PATH: `${process.env.HOME}/.foundry/bin:${process.env.PATH}`,
  };
  const tests = await runCommand("forge test -vvv", contractsDir, env);
  const fuzz = await runCommand(
    'forge test --match-path "test/fuzz/*" -vvv',
    contractsDir,
    env,
  );
  const gas = await runCommand(
    'forge snapshot --match-path "test/benchmark/*"',
    contractsDir,
    env,
  );

  return {
    tests: tests.ok ? "pass" : "fail",
    fuzz: fuzz.ok ? "pass" : "fail",
    gas: gas.ok ? "pass" : "fail",
    output: [
      "$ forge test -vvv",
      tests.output,
      '$ forge test --match-path "test/fuzz/*" -vvv',
      fuzz.output,
      '$ forge snapshot --match-path "test/benchmark/*"',
      gas.output,
    ].join("\n\n"),
  };
}

async function runCommand(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(`${command} 2>&1`, {
      cwd,
      env,
      timeout: 180_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    const output = stdout + stderr;
    return {
      ok: !/0 passed; [1-9]\d* failed|FAIL|Error:/i.test(output),
      output,
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      output: (err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? ""),
    };
  }
}

function extensionFromArtifacts(
  artifacts: { relativePath: string; content: string }[],
): string | undefined {
  const extensions = artifacts.find(
    (artifact) => artifact.relativePath === "extensions.json",
  );
  if (!extensions) return undefined;
  try {
    const parsed = JSON.parse(extensions.content) as { extension?: string };
    return parsed.extension;
  } catch {
    return undefined;
  }
}
