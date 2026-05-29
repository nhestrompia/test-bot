export type SupportedChain = "base" | "ethereum" | "solana" | "bsc" | "arbitrum" | "polygon";

export type CliOptions = {
  chain: SupportedChain;
  target: string;
  budgetUsd: number;
  dryRun: boolean;
};

export type RiskLevel = "low" | "medium" | "high";

export type FreeMarketSummary = {
  target: string;
  chain: SupportedChain;
  resolvedName?: string;
  symbol?: string;
  tokenAddress?: string;
  pairCount: number;
  topPairUrl?: string;
  topDex?: string;
  topLiquidityUsd?: number;
  totalLiquidityUsd?: number;
  volume24hUsd?: number;
  priceChange24hPct?: number;
  pairAgeHours?: number;
  websites: string[];
  socials: string[];
  source: string;
  warnings: string[];
};

export type RiskScore = {
  score: number;
  level: RiskLevel;
  confidence: number;
  warnings: string[];
  positives: string[];
  needsPaidEnrichment: boolean;
};

export type PaidCallPlan = {
  provider: "stableenrich-exa" | "twit-sh" | "onchainexpat-token-metadata";
  label: string;
  url: string;
  method: "GET" | "POST";
  body?: unknown;
  estimatedCostUsd: number;
};

export type PaymentTrace = {
  provider: PaidCallPlan["provider"];
  label: string;
  url: string;
  method: PaidCallPlan["method"];
  estimatedCostUsd: number;
  actualCostUsd: number;
  status: "skipped" | "dry-run" | "paid" | "failed";
  reason?: string;
  receipt?: Record<string, unknown>;
};

export type PaidEnrichment = {
  webFindings: string[];
  socialFindings: string[];
  traces: PaymentTrace[];
};

export type AgentResult = {
  options: CliOptions;
  free: FreeMarketSummary;
  risk: RiskScore;
  enrichment: PaidEnrichment;
  amountSpentUsd: number;
};
