import { envLoadRecords } from "./env.js";
import { floeCredentialEnvNames, getFloeCredential } from "./floeEnv.js";
import { inspectFloeKey } from "./floeKey.js";

const requestedAgentName = readArgValue("agent");
const credential = getFloeCredential(requestedAgentName);
const apiKey = credential?.key ?? "";
const apiBaseUrl = process.env.FLOE_API_BASE_URL ?? "https://credit-api.floelabs.xyz";
const proxyUrl = process.env.FLOE_X402_PROXY_URL ?? `${apiBaseUrl}/v1/proxy/fetch`;
const showKey = process.argv.includes("--show-key");

async function main() {
  const supportedEnvNames = floeCredentialEnvNames(requestedAgentName);
  const envKeyRecord = envLoadRecords.find((record) => record.key === credential?.envName);
  const relevantDotEnvRecords = envLoadRecords.filter((record) => supportedEnvNames.includes(record.key));
  const keyInfo = {
    ...inspectFloeKey(apiKey),
    envName: credential?.envName,
    agentName: credential?.agentName ?? requestedAgentName ?? process.env.FLOE_AGENT_NAME,
    source: envKeyRecord?.applied ? envKeyRecord.source : envKeyRecord ? "shell-env" : "missing",
    dotEnvApplied: envKeyRecord?.applied ?? false,
    dotEnvReason: envKeyRecord?.reason,
    supportedEnvNames,
    relevantDotEnvRecords: relevantDotEnvRecords.map((record) => ({
      key: record.key,
      applied: record.applied,
      reason: record.reason,
      redacted: inspectFloeKey(record.value).redacted,
    })),
    runtimeValue: showKey ? apiKey : undefined,
    dotEnvValue: showKey ? envKeyRecord?.value : undefined,
    valuesMatch: envKeyRecord ? apiKey === envKeyRecord.value : undefined,
  };

  const credit = await probeCreditApi();
  const agentBalance = await probeAgentEndpoint("/v1/agents/balance");
  const creditRemaining = await probeAgentEndpoint("/v1/agents/credit-remaining");
  const proxy = await probeProxy();

  process.stdout.write(
    `${JSON.stringify(
      {
        floeKey: keyInfo,
        creditApi: credit,
        agentBalance,
        creditRemaining,
        x402Proxy: proxy,
      },
      null,
      2,
    )}\n`,
  );
}

async function probeCreditApi() {
  if (!apiKey) {
    return { ok: false, status: "skipped", reason: "No Floe agent key env var loaded" };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/v1/x402/estimate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ url: "https://stableenrich.dev/api/exa/search", method: "POST" }),
    });
    const body = await safeBody(response);
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error: unknown) {
    return { ok: false, status: "network-error", error: describeError(error) };
  }
}

async function probeAgentEndpoint(path: string) {
  if (!apiKey) {
    return { ok: false, status: "skipped", reason: "No Floe agent key env var loaded" };
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
    });
    const body = await safeBody(response);
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error: unknown) {
    return { ok: false, status: "network-error", error: describeError(error) };
  }
}

async function probeProxy() {
  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: apiKey
        ? {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            accept: "application/json",
          }
        : {
            "content-type": "application/json",
            accept: "application/json",
          },
      body: JSON.stringify({
        url: "https://stableenrich.dev/api/exa/search",
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ query: "diagnostic", numResults: 1 }),
      }),
    });
    const body = await safeBody(response);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
    };
  } catch (error: unknown) {
    return { ok: false, status: "network-error", error: describeError(error) };
  }
}

async function safeBody(response: Response) {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && "apiKey" in parsed) {
      return { redacted: true };
    }
    return parsed;
  } catch {
    return text.slice(0, 300);
  }
}

function describeError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  const record = error as Record<string, unknown>;
  const cause = typeof record.cause === "object" && record.cause !== null ? (record.cause as Record<string, unknown>) : undefined;
  return {
    message: record.message,
    code: record.code,
    causeCode: cause?.code,
    causeReason: cause?.reason,
  };
}

function readArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
