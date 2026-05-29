import { z } from "zod";
import type { FreeMarketSummary, SupportedChain } from "../types.js";

const chainMap: Record<SupportedChain, string> = {
  base: "base",
  ethereum: "ethereum",
  solana: "solana",
  bsc: "bsc",
  arbitrum: "arbitrum",
  polygon: "polygon",
};

const pairSchema = z
  .object({
    chainId: z.string().optional(),
    dexId: z.string().optional(),
    url: z.string().optional(),
    pairAddress: z.string().optional(),
    baseToken: z.object({ address: z.string().optional(), name: z.string().optional(), symbol: z.string().optional() }).optional(),
    quoteToken: z.object({ address: z.string().optional(), name: z.string().optional(), symbol: z.string().optional() }).optional(),
    priceUsd: z.string().nullable().optional(),
    txns: z.record(z.object({ buys: z.number().optional(), sells: z.number().optional() })).optional(),
    volume: z.record(z.number()).optional(),
    priceChange: z.record(z.number()).nullable().optional(),
    liquidity: z.object({ usd: z.number().optional(), base: z.number().optional(), quote: z.number().optional() }).nullable().optional(),
    fdv: z.number().nullable().optional(),
    marketCap: z.number().nullable().optional(),
    pairCreatedAt: z.number().nullable().optional(),
    info: z
      .object({
        websites: z.array(z.object({ url: z.string().optional() })).optional(),
        socials: z.array(z.object({ platform: z.string().optional(), handle: z.string().optional() })).optional(),
      })
      .optional(),
  })
  .passthrough();

const pairListSchema = z.array(pairSchema);
const searchSchema = z.object({ pairs: z.array(pairSchema).optional() }).passthrough();

export async function fetchFreeMarketSummary(chain: SupportedChain, target: string): Promise<FreeMarketSummary> {
  const chainId = chainMap[chain];
  const pairs = looksLikeAddress(target) ? await fetchTokenPairs(chainId, target) : await searchPairs(chainId, target);

  if (pairs.length === 0) {
    return {
      target,
      chain,
      pairCount: 0,
      websites: [],
      socials: [],
      source: "DEX Screener",
      warnings: ["No DEX Screener pairs found for this target."],
    };
  }

  const sortedPairs = [...pairs].sort((a, b) => usd(b.liquidity?.usd) - usd(a.liquidity?.usd));
  const topPair = sortedPairs[0];
  const totalLiquidityUsd = sortedPairs.reduce((sum, pair) => sum + usd(pair.liquidity?.usd), 0);
  const websites = unique(sortedPairs.flatMap((pair) => pair.info?.websites?.map((site) => site.url).filter(Boolean) ?? []) as string[]);
  const socials = unique(
    sortedPairs.flatMap((pair) =>
      pair.info?.socials?.map((social) => [social.platform, social.handle].filter(Boolean).join(":")).filter(Boolean) ?? [],
    ) as string[],
  );
  const pairAgeHours = topPair.pairCreatedAt ? Math.max(0, (Date.now() - topPair.pairCreatedAt) / 3_600_000) : undefined;

  return {
    target,
    chain,
    resolvedName: topPair.baseToken?.name,
    symbol: topPair.baseToken?.symbol,
    tokenAddress: topPair.baseToken?.address,
    pairCount: sortedPairs.length,
    topPairUrl: topPair.url,
    topDex: topPair.dexId,
    topLiquidityUsd: topPair.liquidity?.usd,
    totalLiquidityUsd,
    volume24hUsd: topPair.volume?.h24,
    priceChange24hPct: topPair.priceChange?.h24,
    pairAgeHours,
    websites,
    socials,
    source: "DEX Screener",
    warnings: [],
  };
}

async function fetchTokenPairs(chainId: string, tokenAddress: string) {
  const url = `https://api.dexscreener.com/tokens/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(tokenAddress)}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`DEX Screener token lookup failed: ${response.status} ${response.statusText}`);
  }

  return pairListSchema.parse(await response.json());
}

async function searchPairs(chainId: string, target: string) {
  const url = new URL("https://api.dexscreener.com/latest/dex/search");
  url.searchParams.set("q", target);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`DEX Screener search failed: ${response.status} ${response.statusText}`);
  }

  const result = searchSchema.parse(await response.json());
  return (result.pairs ?? []).filter((pair) => pair.chainId === chainId);
}

function looksLikeAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function usd(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value) ? 0 : value;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).slice(0, 6);
}
