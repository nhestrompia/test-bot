import { describe, expect, it } from "vitest";
import { decidePaidCalls } from "../src/clients/payment.js";
import type { PaidCallPlan } from "../src/types.js";

const plans: PaidCallPlan[] = [
  {
    provider: "stableenrich-exa",
    label: "Web",
    url: "https://stableenrich.dev/api/exa/search",
    method: "POST",
    estimatedCostUsd: 0.04,
  },
  {
    provider: "twit-sh",
    label: "Social",
    url: "https://x402.twit.sh/tweets/search?words=test",
    method: "GET",
    estimatedCostUsd: 0.02,
  },
];

describe("decidePaidCalls", () => {
  it("skips calls that would exceed the budget", () => {
    const skipped = decidePaidCalls(plans, 0.05);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].provider).toBe("twit-sh");
    expect(skipped[0].status).toBe("skipped");
  });

  it("allows all calls when the budget is sufficient", () => {
    expect(decidePaidCalls(plans, 0.07)).toHaveLength(0);
  });
});
