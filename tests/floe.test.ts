import { afterEach, describe, expect, it, vi } from "vitest";
import { Floe } from "../src/clients/floe.js";

describe("Floe client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes proxied POST bodies as strings for Floe's proxy schema", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true }, cost: 0.01, receipt_id: "req_test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const floe = new Floe({ apiKey: "floe_test", proxyUrl: "https://credit-api.floelabs.xyz/v1/proxy/fetch" });
    await floe.post("https://stableenrich.dev/api/exa/search", {
      body: { query: "eth risk", numResults: 3 },
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(request.body).toBe(JSON.stringify({ query: "eth risk", numResults: 3 }));
    expect(request.headers).toEqual({ accept: "application/json", "content-type": "application/json" });
  });
});
