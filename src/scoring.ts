import type { FreeMarketSummary, RiskLevel, RiskScore } from "./types.js";

export function scoreMarketRisk(summary: FreeMarketSummary): RiskScore {
  const warnings = [...summary.warnings];
  const positives: string[] = [];
  let score = 35;
  let confidence = 0.35;

  if (summary.pairCount === 0) {
    return {
      score: 90,
      level: "high",
      confidence: 0.25,
      warnings: ["No tradable DEX pairs found; cannot validate liquidity or market behavior."],
      positives: [],
      needsPaidEnrichment: true,
    };
  }

  if (valueBelow(summary.topLiquidityUsd, 10_000)) {
    score += 25;
    warnings.push("Top pool liquidity is below $10k.");
  } else if (valueAtLeast(summary.topLiquidityUsd, 100_000)) {
    score -= 15;
    positives.push("Top pool liquidity is above $100k.");
  }

  if (valueBelow(summary.volume24hUsd, 5_000)) {
    score += 10;
    warnings.push("24h volume is thin.");
  } else if (valueAtLeast(summary.volume24hUsd, 50_000)) {
    score -= 8;
    positives.push("24h volume is meaningful.");
  }

  if (summary.pairAgeHours !== undefined && summary.pairAgeHours < 24) {
    score += 20;
    warnings.push("Top pool is less than 24 hours old.");
  } else if (summary.pairAgeHours !== undefined && summary.pairAgeHours > 24 * 30) {
    score -= 8;
    positives.push("Top pool has more than 30 days of history.");
  }

  if (summary.priceChange24hPct !== undefined && Math.abs(summary.priceChange24hPct) > 50) {
    score += 12;
    warnings.push("24h price move is larger than 50%.");
  }

  if (summary.pairCount === 1) {
    score += 8;
    warnings.push("Only one DEX pair was found.");
  } else if (summary.pairCount >= 3) {
    score -= 5;
    positives.push("Multiple DEX pairs were found.");
  }

  if (summary.websites.length === 0 && summary.socials.length === 0) {
    score += 8;
    warnings.push("No project website or social links were present in DEX Screener metadata.");
  }

  confidence += summary.topLiquidityUsd !== undefined ? 0.18 : 0;
  confidence += summary.volume24hUsd !== undefined ? 0.14 : 0;
  confidence += summary.pairAgeHours !== undefined ? 0.14 : 0;
  confidence += summary.websites.length > 0 || summary.socials.length > 0 ? 0.1 : 0;

  const boundedScore = clamp(Math.round(score), 0, 100);
  return {
    score: boundedScore,
    level: riskLevel(boundedScore),
    confidence: clamp(Number(confidence.toFixed(2)), 0, 0.95),
    warnings,
    positives,
    needsPaidEnrichment: true,
  };
}

function riskLevel(score: number): RiskLevel {
  if (score >= 70) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  return "low";
}

function valueBelow(value: number | undefined, threshold: number): boolean {
  return value === undefined || value < threshold;
}

function valueAtLeast(value: number | undefined, threshold: number): boolean {
  return value !== undefined && value >= threshold;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
