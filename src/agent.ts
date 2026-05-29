import { fetchFreeMarketSummary } from "./clients/dexscreener.js";
import { fetchPaidEnrichment } from "./clients/paidEnrichment.js";
import { scoreMarketRisk } from "./scoring.js";
import type { AgentResult, CliOptions, PaidCallPlan } from "./types.js";

export async function runRiskResearch(options: CliOptions): Promise<AgentResult> {
  const free = await fetchFreeMarketSummary(options.chain, options.target);
  const risk = scoreMarketRisk(free);
  const paidPlans = buildPaidPlans(options.target, free);
  const enrichment = await fetchPaidEnrichment({
    risk,
    plans: paidPlans,
    budgetUsd: options.budgetUsd,
    dryRun: options.dryRun,
  });
  const amountSpentUsd = enrichment.traces.reduce((sum, trace) => sum + trace.actualCostUsd, 0);

  return {
    options,
    free,
    risk,
    enrichment,
    amountSpentUsd,
  };
}

function buildPaidPlans(target: string, free: { chain?: string; resolvedName?: string; symbol?: string; tokenAddress?: string }): PaidCallPlan[] {
  const queryName = [free.resolvedName, free.symbol, target].filter(Boolean).join(" ");
  const exaQuery = `${queryName} ${free.chain ?? ""} token market risk liquidity exploit scam contract`;
  const twitterUrl = new URL("https://x402.twit.sh/tweets/search");
  twitterUrl.searchParams.set("words", free.symbol ?? free.resolvedName ?? target);
  twitterUrl.searchParams.set("anyWords", "risk rug exploit scam honeypot hack drain liquidity");
  twitterUrl.searchParams.set("minLikes", "1");
  const plans: PaidCallPlan[] = [
    {
      provider: "stableenrich-exa",
      label: "Paid web/protocol context",
      url: "https://stableenrich.dev/api/exa/search",
      method: "POST",
      estimatedCostUsd: 0.01,
      body: {
        query: exaQuery,
        numResults: 3,
        type: "auto",
        contents: {
          highlights: {
            numSentences: 2,
            highlightsPerUrl: 1,
            query: exaQuery,
          },
        },
      },
    },
    {
      provider: "twit-sh",
      label: "Paid X/Twitter chatter",
      url: twitterUrl.toString(),
      method: "GET",
      estimatedCostUsd: 0.01,
    },
  ];

  if (free.tokenAddress && isNonZeroEvmAddress(free.tokenAddress) && free.chain !== "solana") {
    plans.push({
      provider: "onchainexpat-token-metadata",
      label: "Paid token safety metadata",
      url: "https://x402.onchainexpat.com/api/x402-crypto/token-metadata",
      method: "POST",
      estimatedCostUsd: 0.02,
      body: {
        address: free.tokenAddress,
        chain: free.chain ?? "base",
      },
    });
  }

  return plans;
}

function isNonZeroEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
}
