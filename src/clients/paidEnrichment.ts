import { PaymentClient, decidePaidCalls } from "./payment.js";
import type { PaidCallPlan, PaidEnrichment, RiskScore } from "../types.js";

type EnrichmentInput = {
  risk: RiskScore;
  plans: PaidCallPlan[];
  budgetUsd: number;
  dryRun: boolean;
};

export async function fetchPaidEnrichment(input: EnrichmentInput): Promise<PaidEnrichment> {
  if (!input.risk.needsPaidEnrichment) {
    return {
      webFindings: [],
      socialFindings: [],
      traces: input.plans.map((plan) => ({
        provider: plan.provider,
        label: plan.label,
        url: plan.url,
        method: plan.method,
        estimatedCostUsd: plan.estimatedCostUsd,
        actualCostUsd: 0,
        status: "skipped",
        reason: "Free data confidence was high enough",
      })),
    };
  }

  const preflightSkips = decidePaidCalls(input.plans, input.budgetUsd);
  const skippedUrls = new Set(preflightSkips.map(({ url }) => url));
  const payablePlans = input.plans.filter(({ url }) => !skippedUrls.has(url));
  const paymentClient = new PaymentClient(input.dryRun);
  const paidResults = await Promise.all(payablePlans.map((plan) => paymentClient.paidFetch(plan)));

  return {
    webFindings: paidResults.flatMap((result) => extractWebFindings(result.data)),
    socialFindings: paidResults.flatMap((result) => extractSocialFindings(result.data)),
    traces: [...paidResults.map((result) => result.trace), ...preflightSkips],
  };
}

function extractWebFindings(data: unknown): string[] {
  if (!isRecord(data)) {
    return [];
  }

  const tokenSafety = extractTokenSafetyFinding(data);
  if (tokenSafety) {
    return [tokenSafety];
  }

  const results = Array.isArray(data.results) ? data.results : [];
  return results.map(formatWebFinding).filter(isString).slice(0, 3);
}

function formatWebFinding(item: unknown): string | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const title = typeof item.title === "string" ? item.title : "Untitled result";
  const url = typeof item.url === "string" ? item.url : "";
  const highlight = Array.isArray(item.highlights) && typeof item.highlights[0] === "string" ? cleanText(item.highlights[0], 220) : undefined;
  const text = typeof item.text === "string" ? cleanText(item.text, 220) : undefined;
  return [title, url, highlight ?? text].filter(Boolean).join(" - ");
}

function extractTokenSafetyFinding(data: Record<string, unknown>): string | undefined {
  const payload = isRecord(data.data) ? data.data : data;
  const riskScore = numberField(payload, "risk_score");
  const riskLevel = stringField(payload, "risk_level");
  const verified = booleanField(payload, "contract_verified");
  const holders = numberField(payload, "holder_count");
  const safety = isRecord(payload.safety) ? payload.safety : undefined;
  const flags = safety
    ? ["honeypot", "mintable", "blacklist"]
        .map((field) => {
          const value = booleanField(safety, field);
          return value === undefined ? undefined : `${field}=${value}`;
        })
        .filter(Boolean)
        .join(", ")
    : undefined;

  if (riskScore === undefined && riskLevel === undefined && verified === undefined && holders === undefined && !flags) {
    return undefined;
  }

  return [
    "OnchainExpat token metadata",
    riskScore !== undefined ? `risk_score=${riskScore}` : undefined,
    riskLevel ? `risk_level=${riskLevel}` : undefined,
    verified !== undefined ? `contract_verified=${verified}` : undefined,
    holders !== undefined ? `holders=${holders}` : undefined,
    flags,
  ]
    .filter(Boolean)
    .join(" - ");
}

function extractSocialFindings(data: unknown): string[] {
  if (!isRecord(data)) {
    return [];
  }

  const tweets = Array.isArray(data.tweets) ? data.tweets : Array.isArray(data.data) ? data.data : [];
  return tweets.map(formatSocialFinding).filter(isString).slice(0, 3);
}

function formatSocialFinding(item: unknown): string | undefined {
  if (!isRecord(item)) {
    return undefined;
  }

  const text = typeof item.text === "string" ? item.text : typeof item.full_text === "string" ? item.full_text : undefined;
  const id = typeof item.id === "string" ? item.id : undefined;
  const url = typeof item.url === "string" ? item.url : id ? `https://x.com/i/web/status/${id}` : undefined;
  const metrics = isRecord(item.public_metrics) ? item.public_metrics : undefined;
  const likes = numberField(metrics, "like_count");
  const replies = numberField(metrics, "reply_count");
  const metricText = [likes !== undefined ? `${likes} likes` : undefined, replies !== undefined ? `${replies} replies` : undefined].filter(Boolean).join(", ");
  const parts = [cleanText(text, 180), metricText || undefined, url].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : undefined;
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/\[\.\.\.\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

function stringField(value: Record<string, unknown> | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value[field] === "string" ? value[field] : undefined;
}

function numberField(value: Record<string, unknown> | undefined, field: string): number | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value[field] === "number" ? value[field] : undefined;
}

function booleanField(value: Record<string, unknown> | undefined, field: string): boolean | undefined {
  if (!value) {
    return undefined;
  }

  return typeof value[field] === "boolean" ? value[field] : undefined;
}
