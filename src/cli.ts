import "./env.js";
import { runRiskResearch } from "./agent.js";
import { formatAgentResult } from "./format.js";
import type { CliOptions, SupportedChain } from "./types.js";

const supportedChains = new Set<SupportedChain>(["base", "ethereum", "solana", "bsc", "arbitrum", "polygon"]);

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function parseOptions(): CliOptions {
  const chain = (readArg("chain") ?? "base") as SupportedChain;
  const target = readArg("target");
  const budget = Number(readArg("budget") ?? "0.05");
  const dryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

  if (!supportedChains.has(chain)) {
    throw new Error(`Unsupported chain "${chain}". Use one of: ${Array.from(supportedChains).join(", ")}`);
  }

  if (!target) {
    throw new Error("Missing --target <token-address-or-query>");
  }

  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error("--budget must be a positive USD number");
  }

  return { chain, target, budgetUsd: budget, dryRun };
}

async function main() {
  const result = await runRiskResearch(parseOptions());
  process.stdout.write(`${formatAgentResult(result)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Demo failed: ${message}\n`);
  process.exitCode = 1;
});
