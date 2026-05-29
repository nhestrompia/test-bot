import type { AgentResult, PaymentTrace } from "./types.js";

export function formatAgentResult(result: AgentResult): string {
  const { options, free, risk, enrichment } = result;

  return [
    "# x402 Risk Research Brief",
    "",
    "## Executive summary",
    `- Verdict: ${risk.level.toUpperCase()} risk (${risk.score}/100) with ${(risk.confidence * 100).toFixed(0)}% free-data confidence.`,
    `- Market: ${marketDigest(result)}`,
    `- Paid context: ${paidDigest(result)}`,
    `- Spend: $${result.amountSpentUsd.toFixed(4)} of $${options.budgetUsd.toFixed(2)} budget.`,
    "",
    "## Target",
    `- Query: ${options.target} on ${options.chain}`,
    `- Resolved: ${[free.resolvedName, free.symbol].filter(Boolean).join(" / ") || "unresolved"}`,
    free.tokenAddress ? `- Token address: ${free.tokenAddress}` : undefined,
    free.topPairUrl ? `- Primary DEX pair: ${free.topPairUrl}` : undefined,
    "",
    "## Market signals",
    `- Liquidity: ${formatUsd(free.topLiquidityUsd)} top pool, ${formatUsd(free.totalLiquidityUsd)} observed total`,
    `- Activity: ${formatUsd(free.volume24hUsd)} 24h volume across ${free.pairCount} pair${free.pairCount === 1 ? "" : "s"}`,
    `- Price action: ${free.priceChange24hPct !== undefined ? `${free.priceChange24hPct.toFixed(2)}% over 24h` : "unavailable"}`,
    `- Pool age: ${free.pairAgeHours !== undefined ? formatHours(free.pairAgeHours) : "unavailable"}`,
    "",
    "## Paid intelligence",
    ...formatList("Web/protocol context", enrichment.webFindings, 3),
    ...formatList("Social sentiment", enrichment.socialFindings, 3),
    "",
    "## Risk drivers",
    ...formatList("Warnings", risk.warnings, 5),
    ...formatList("Positive signals", risk.positives, 5),
    "",
    "## Payment trace",
    ...formatPaymentTrace(enrichment.traces),
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

export function formatPaymentTrace(traces: PaymentTrace[]): string[] {
  if (traces.length === 0) {
    return ["- No paid calls planned."];
  }

  return traces.map((trace) => {
    const receipt = summarizeReceipt(trace.receipt);
    const reason = trace.reason ? `, reason="${truncate(trace.reason, 140)}"` : "";
    const receiptText = receipt ? `, ${receipt}` : "";
    return `- ${trace.provider}: ${trace.status}, est=$${trace.estimatedCostUsd.toFixed(4)}, actual=$${trace.actualCostUsd.toFixed(4)}${reason}${receiptText}`;
  });
}

function marketDigest(result: AgentResult): string {
  const { free } = result;
  return `${formatUsd(free.topLiquidityUsd)} top liquidity, ${formatUsd(free.volume24hUsd)} 24h volume, ${
    free.priceChange24hPct !== undefined ? `${free.priceChange24hPct.toFixed(2)}% 24h move` : "price move unavailable"
  }.`;
}

function paidDigest(result: AgentResult): string {
  const paidCount = result.enrichment.traces.filter((trace) => trace.status === "paid").length;
  const dryRunCount = result.enrichment.traces.filter((trace) => trace.status === "dry-run").length;
  const failedCount = result.enrichment.traces.filter((trace) => trace.status === "failed").length;
  const webCount = result.enrichment.webFindings.length;
  const socialCount = result.enrichment.socialFindings.length;

  if (dryRunCount > 0) {
    return `${plural(dryRunCount, "paid call")} simulated; ${signalSummary(webCount, socialCount)} summarized.`;
  }

  if (paidCount === 0 && failedCount === 0) {
    return "No paid calls were needed.";
  }

  return `${plural(paidCount, "paid call")} completed; ${signalSummary(webCount, socialCount)} summarized.`;
}

function formatList(title: string, items: string[], limit: number): string[] {
  if (items.length === 0) {
    return [`- ${title}: none found`];
  }

  const visible = items.slice(0, limit).map((item) => `  - ${truncate(item, 260)}`);
  const remaining = items.length - visible.length;
  return [`- ${title}:`, ...visible, remaining > 0 ? `  - ${remaining} more omitted` : undefined].filter((line): line is string => line !== undefined);
}

function summarizeReceipt(receipt: Record<string, unknown> | undefined): string | undefined {
  if (!receipt) {
    return undefined;
  }

  const preflight = recordField(receipt, "preflight");
  const proxy = recordField(receipt, "proxy");
  const receiptId = stringField(receipt, "receipt_id") ?? stringField(proxy, "requestId");
  const x402 = booleanField(preflight, "x402");
  const priceRaw = stringField(preflight, "priceRaw");
  const network = stringField(preflight, "network");
  const payTo = stringField(preflight, "payTo");
  const resultCount = arrayField(proxy, "results")?.length ?? arrayField(proxy, "data")?.length;

  const parts = [
    receiptId ? `receipt=${receiptId}` : undefined,
    x402 !== undefined ? `x402=${x402}` : undefined,
    priceRaw ? `priceRaw=${priceRaw}` : undefined,
    network ? `network=${network}` : undefined,
    payTo ? `payTo=${shortAddress(payTo)}` : undefined,
    resultCount !== undefined ? `results=${resultCount}` : undefined,
    fallbackError(receipt),
  ];

  return parts.filter(Boolean).join(", ") || undefined;
}

function fallbackError(receipt: Record<string, unknown>): string | undefined {
  const error = stringField(receipt, "error") ?? stringField(recordField(receipt, "proxy"), "error");
  return error ? `error=${truncate(error, 80)}` : undefined;
}

function formatUsd(value: number | undefined): string {
  return value === undefined ? "unavailable" : `$${Math.round(value).toLocaleString("en-US")}`;
}

function signalSummary(webCount: number, socialCount: number): string {
  return `${plural(webCount, "web signal")} and ${plural(socialCount, "social signal")}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatHours(hours: number): string {
  if (hours < 48) {
    return `${hours.toFixed(1)} hours`;
  }

  return `${(hours / 24).toFixed(1)} days`;
}

function truncate(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function recordField(value: Record<string, unknown> | undefined, field: string): Record<string, unknown> | undefined {
  const candidate = value?.[field];
  return typeof candidate === "object" && candidate !== null ? (candidate as Record<string, unknown>) : undefined;
}

function arrayField(value: Record<string, unknown> | undefined, field: string): unknown[] | undefined {
  const candidate = value?.[field];
  return Array.isArray(candidate) ? candidate : undefined;
}

function stringField(value: Record<string, unknown> | undefined, field: string): string | undefined {
  return typeof value?.[field] === "string" ? value[field] : undefined;
}

function booleanField(value: Record<string, unknown> | undefined, field: string): boolean | undefined {
  return typeof value?.[field] === "boolean" ? value[field] : undefined;
}

function shortAddress(value: string): string {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}
