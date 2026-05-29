import { afterEach, describe, expect, it } from "vitest";
import { floeCredentialEnvNames, getFloeCredential } from "../src/floeEnv.js";

const envSnapshot = { ...process.env };

describe("getFloeCredential", () => {
  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("prefers FLOE_KEY but keeps documented compatibility names", () => {
    delete process.env.FLOE_KEY;
    process.env.FLOE_API_KEY = "floe_api";
    process.env.FLOE_FACILITATOR_API_KEY = "floe_facilitator";

    expect(getFloeCredential()).toEqual({ envName: "FLOE_API_KEY", key: "floe_api" });

    process.env.FLOE_KEY = "floe_primary";
    expect(getFloeCredential()).toEqual({ envName: "FLOE_KEY", key: "floe_primary" });
  });

  it("includes named floe-agent fallback env vars", () => {
    expect(floeCredentialEnvNames("research")).toContain("FLOE_AGENT_KEY_RESEARCH__CREDIT_API_FLOELABS_XYZ");
  });
});
