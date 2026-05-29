import { describe, expect, it } from "vitest";
import { scoreMarketRisk } from "../src/scoring.js";
import type { FreeMarketSummary } from "../src/types.js";

const baseSummary: FreeMarketSummary = {
  target: "TOKEN",
  chain: "base",
  resolvedName: "Token",
  symbol: "TKN",
  pairCount: 3,
  topLiquidityUsd: 250_000,
  totalLiquidityUsd: 300_000,
  volume24hUsd: 80_000,
  priceChange24hPct: 4,
  pairAgeHours: 24 * 90,
  websites: ["https://example.com"],
  socials: ["twitter:example"],
  source: "DEX Screener",
  warnings: [],
};

describe("scoreMarketRisk", () => {
  it("scores old liquid markets as lower risk", () => {
    const result = scoreMarketRisk(baseSummary);
    expect(result.level).toBe("low");
    expect(result.needsPaidEnrichment).toBe(false);
  });

  it("scores low-liquidity fresh markets as high risk", () => {
    const result = scoreMarketRisk({
      ...baseSummary,
      pairCount: 1,
      topLiquidityUsd: 2_000,
      totalLiquidityUsd: 2_000,
      volume24hUsd: 400,
      priceChange24hPct: 120,
      pairAgeHours: 5,
      websites: [],
      socials: [],
    });

    expect(result.level).toBe("high");
    expect(result.needsPaidEnrichment).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it("requests paid enrichment when market data is missing", () => {
    const result = scoreMarketRisk({
      ...baseSummary,
      pairCount: 0,
      topLiquidityUsd: undefined,
      volume24hUsd: undefined,
      pairAgeHours: undefined,
    });

    expect(result.score).toBe(90);
    expect(result.needsPaidEnrichment).toBe(true);
  });
});
