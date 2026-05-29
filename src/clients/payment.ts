import type { PaidCallPlan, PaymentTrace } from "../types.js";
import { getFloeCredential } from "../floeEnv.js";
import { inspectFloeKey } from "../floeKey.js";
import { Floe, FloeError } from "./floe.js";

type PaidFetchResult = {
  data: unknown;
  trace: PaymentTrace;
};

type TracePatch = Pick<PaymentTrace, "status"> & Partial<Omit<PaymentTrace, "provider" | "label" | "url" | "method" | "status">>;

type FloePreflight = {
  ok: boolean;
  costUsd?: number;
  receipt?: Record<string, unknown>;
  error?: string;
};

export class PaymentClient {
  private readonly credential = getFloeCredential();
  private readonly apiKey = this.credential?.key;
  private readonly apiBaseUrl = process.env.FLOE_API_BASE_URL ?? "https://credit-api.floelabs.xyz";
  private readonly proxyUrl = process.env.FLOE_X402_PROXY_URL ?? `${this.apiBaseUrl}/v1/proxy/fetch`;

  constructor(private readonly dryRun: boolean) {}

  async paidFetch(plan: PaidCallPlan): Promise<PaidFetchResult> {
    if (this.dryRun || !this.apiKey) {
      const reason = this.dryRun ? "DRY_RUN=true" : "No Floe agent key env var was loaded";
      return {
        data: dryRunPayload(plan),
        trace: traceFor(plan, {
          actualCostUsd: 0,
          status: "dry-run",
          reason,
          receipt: { mode: "dry-run", estimatedCostUsd: plan.estimatedCostUsd },
        }),
      };
    }

    const preflight = await this.estimateX402Cost(plan);
    if (!preflight.ok) {
      const keyInfo = inspectFloeKey(this.apiKey);
      return {
        data: preflight.receipt ?? {},
        trace: traceFor(plan, {
          actualCostUsd: 0,
          status: "failed",
          reason: formatPreflightFailure(preflight.error, keyInfo.formatHint),
          receipt: {
            backend: "floe",
            step: "estimate_x402_cost",
            envName: this.credential?.envName,
            key: keyInfo,
            ...(preflight.receipt ?? {}),
          },
        }),
      };
    }

    const estimatedCostUsd = preflight.costUsd ?? plan.estimatedCostUsd;
    try {
      const floe = new Floe({ apiKey: this.apiKey, apiBaseUrl: this.apiBaseUrl, proxyUrl: this.proxyUrl });
      const payload = await floe.fetch({
        url: plan.url,
        method: plan.method,
        body: plan.body,
      });

      return {
        data: payload.data,
        trace: traceFor(plan, {
          estimatedCostUsd,
          actualCostUsd: payload.cost ?? estimatedCostUsd,
          status: "paid",
          receipt: {
            preflight: preflight.receipt,
            receipt_id: payload.receipt_id,
            proxy: isRecord(payload.raw) ? payload.raw : { payload: payload.raw },
          },
        }),
      };
    } catch (error: unknown) {
      if (error instanceof FloeError) {
        return {
          data: error.payload,
          trace: traceFor(plan, {
            estimatedCostUsd,
            actualCostUsd: 0,
            status: "failed",
            reason: `Floe proxy returned ${error.status} ${error.statusText}`,
            receipt: {
              preflight: preflight.receipt,
              proxy: isRecord(error.payload) ? error.payload : { payload: error.payload },
            },
          }),
        };
      }

      const payload = errorToPayload(error);
      return {
        data: payload,
        trace: traceFor(plan, {
          estimatedCostUsd,
          actualCostUsd: 0,
          status: "failed",
          reason: formatNetworkError(error),
          receipt: {
            backend: "floe",
            proxyUrl: this.proxyUrl,
            ...payload,
          },
        }),
      };
    }
  }

  private async estimateX402Cost(plan: PaidCallPlan): Promise<FloePreflight> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/x402/estimate`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ url: plan.url, method: plan.method }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        return {
          ok: false,
          error: statusMessage(response, payload),
          receipt: isRecord(payload) ? payload : { payload },
        };
      }

      return {
        ok: true,
        costUsd: extractCostUsd(payload),
        receipt: isRecord(payload) ? payload : { payload },
      };
    } catch (error: unknown) {
      return {
        ok: false,
        error: formatNetworkError(error),
        receipt: errorToPayload(error),
      };
    }
  }
}

export function decidePaidCalls(plans: PaidCallPlan[], budgetUsd: number, alreadySpentUsd = 0): PaymentTrace[] {
  let committed = alreadySpentUsd;
  return plans.flatMap((plan) => {
    if (committed + plan.estimatedCostUsd > budgetUsd) {
      return [
        traceFor(plan, {
          actualCostUsd: 0,
          status: "skipped" as const,
          reason: `Estimated spend would exceed $${budgetUsd.toFixed(2)} budget`,
        }),
      ];
    }

    committed += plan.estimatedCostUsd;
    return [];
  });
}

function traceFor(plan: PaidCallPlan, patch: TracePatch): PaymentTrace {
  return {
    provider: plan.provider,
    label: plan.label,
    url: plan.url,
    method: plan.method,
    estimatedCostUsd: plan.estimatedCostUsd,
    actualCostUsd: 0,
    ...patch,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function dryRunPayload(plan: PaidCallPlan): unknown {
  if (plan.provider === "onchainexpat-token-metadata") {
    return {
      success: true,
      data: {
        name: "Dry-run token",
        symbol: "DRY",
        contract_verified: true,
        holder_count: 1234,
        risk_score: 34,
        risk_level: "low",
        safety: {
          honeypot: false,
          mintable: false,
          blacklist: false,
        },
      },
    };
  }

  if (plan.provider === "stableenrich-exa") {
    return {
      results: [
        {
          title: "Dry-run web risk result",
          url: "https://example.com/risk-context",
          highlights: ["Mentions liquidity, contract risk, and recent community discussion."],
          text: "Dry-run placeholder for paid Exa search output.",
        },
      ],
    };
  }

  return {
    tweets: [
      {
        text: "Dry-run X/Twitter chatter: community is discussing liquidity and contract risk.",
        url: "https://x.com/example/status/1",
      },
    ],
  };
}

function errorToPayload(error: unknown): Record<string, unknown> {
  if (isRecord(error)) {
    const cause = isRecord(error.cause) ? error.cause : undefined;
    return {
      message: error.message,
      code: error.code,
      causeCode: cause?.code,
      causeReason: cause?.reason,
    };
  }

  return { message: String(error) };
}

function statusMessage(response: Response, payload: unknown): string {
  if (isRecord(payload)) {
    const error = typeof payload.error === "string" ? payload.error : undefined;
    const message = typeof payload.message === "string" ? payload.message : undefined;
    return [response.status, error, message].filter(Boolean).join(" ");
  }

  return `${response.status} ${response.statusText}`;
}

function extractCostUsd(payload: unknown): number | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const candidates = [
    payload.costUsd,
    payload.costUSDC,
    payload.estimatedCostUsd,
    payload.estimatedCostUSDC,
    payload.amountUsd,
    payload.amountUSDC,
    payload.price,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return candidate;
    }
    if (typeof candidate === "string") {
      const parsed = Number(candidate.replace(/[^\d.]/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function formatNetworkError(error: unknown): string {
  if (!isRecord(error)) {
    return String(error);
  }

  const cause = isRecord(error.cause) ? error.cause : undefined;
  const details = [error.message, cause?.code, cause?.reason].filter(Boolean).join(" - ");
  return details || "Floe proxy request failed";
}

function formatPreflightFailure(error: string | undefined, keyHint: string | undefined): string {
  const base = `Floe estimate_x402_cost failed: ${error ?? "unknown error"}`;
  return keyHint ? `${base}. ${keyHint}` : base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
