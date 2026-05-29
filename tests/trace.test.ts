import { describe, expect, it } from "vitest";
import { formatPaymentTrace } from "../src/format.js";

describe("formatPaymentTrace", () => {
  it("includes provider, status, costs, and receipt metadata", () => {
    const lines = formatPaymentTrace([
      {
        provider: "stableenrich-exa",
        label: "Web",
        url: "https://stableenrich.dev/api/exa/search",
        method: "POST",
        estimatedCostUsd: 0.01,
        actualCostUsd: 0.01,
        status: "paid",
        receipt: { receipt_id: "req_test", preflight: { x402: true, priceRaw: "10000", network: "eip155:8453" } },
      },
    ]);

    expect(lines[0]).toContain("stableenrich-exa");
    expect(lines[0]).toContain("paid");
    expect(lines[0]).toContain("est=$0.0100");
    expect(lines[0]).toContain("receipt=req_test");
    expect(lines[0]).not.toContain("preflight");
  });
});
