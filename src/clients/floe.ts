export type FloeResponse = {
  data: unknown;
  cost?: number;
  receipt_id?: string;
  raw: unknown;
};

type FloeRequest = {
  method: "GET" | "POST";
  url: string;
  body?: unknown;
};

export class Floe {
  private readonly apiBaseUrl: string;
  private readonly proxyUrl: string;

  constructor(private readonly options: { apiKey: string; apiBaseUrl?: string; proxyUrl?: string }) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://credit-api.floelabs.xyz";
    this.proxyUrl = options.proxyUrl ?? `${this.apiBaseUrl}/v1/proxy/fetch`;
  }

  async fetch(request: FloeRequest): Promise<FloeResponse> {
    const headers: Record<string, string> = { accept: "application/json" };
    const body = serializeProxyBody(request.body);
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(this.proxyUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        url: request.url,
        method: request.method,
        headers,
        body,
      }),
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new FloeError(response.status, response.statusText, payload);
    }

    return {
      data: unwrapPayload(payload),
      cost: numberField(payload, "cost") ?? numberField(payload, "costUsd") ?? numberField(payload, "amountUsd"),
      receipt_id: stringField(payload, "receipt_id") ?? stringField(payload, "receiptId") ?? stringField(payload, "requestId"),
      raw: payload,
    };
  }

  async post(pathOrUrl: string, request: { body?: unknown } = {}): Promise<FloeResponse> {
    return this.fetch({ method: "POST", url: normalizeFloeUrl(pathOrUrl), body: request.body });
  }

  async get(pathOrUrl: string): Promise<FloeResponse> {
    return this.fetch({ method: "GET", url: normalizeFloeUrl(pathOrUrl) });
  }
}

export class FloeError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly payload: unknown,
  ) {
    super(`Floe proxy returned ${status} ${statusText}`);
    this.name = "FloeError";
  }
}

function serializeProxyBody(body: unknown): string | undefined {
  if (body === undefined) {
    return undefined;
  }

  return typeof body === "string" ? body : JSON.stringify(body);
}

function normalizeFloeUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const [vendor, ...pathParts] = pathOrUrl.replace(/^\/+/, "").split("/");
  return `https://${vendor}.x402.floe.run/${pathParts.join("/")}`;
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

function unwrapPayload(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  return payload.data ?? payload.body ?? payload.response ?? payload.result ?? payload;
}

function stringField(value: unknown, field: string): string | undefined {
  return isRecord(value) && typeof value[field] === "string" ? value[field] : undefined;
}

function numberField(value: unknown, field: string): number | undefined {
  return isRecord(value) && typeof value[field] === "number" ? value[field] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
