"use server";

import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function runContractTests(): Promise<{
  ok: boolean;
  output: string;
}> {
  const contractsDir = path.join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "contracts",
  );
  try {
    // execAsync rejects on non-zero exit; `forge test` exits 0 only when every test passes.
    const { stdout, stderr } = await execAsync("forge test 2>&1", {
      cwd: contractsDir,
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.foundry/bin:${process.env.PATH}`,
      },
      timeout: 120_000,
    });
    return { ok: true, output: stdout + stderr };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output =
      (err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? "");
    return { ok: false, output: output || "forge not found — install Foundry" };
  }
}
