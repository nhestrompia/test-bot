export type FloeKeyInfo = {
  present: boolean;
  redacted: string;
  length: number;
  agentKeyPrefix: boolean;
  agentKeyFormat: boolean;
  developerKeyFormat: boolean;
  startsWithBearer: boolean;
  hasWhitespace: boolean;
  formatHint?: string;
};

export function inspectFloeKey(value: string): FloeKeyInfo {
  const agentKeyFormat = /^floe_[a-fA-F0-9]{64}$/.test(value);
  const agentKeyPrefix = /^floe_(?!live_).+/.test(value);
  const developerKeyFormat = /^floe_live_[A-Za-z0-9]+$/.test(value);
  const startsWithBearer = value.toLowerCase().startsWith("bearer ");
  const hasWhitespace = /\s/.test(value);

  return {
    present: value.length > 0,
    redacted: redact(value),
    length: value.length,
    agentKeyPrefix,
    agentKeyFormat,
    developerKeyFormat,
    startsWithBearer,
    hasWhitespace,
    formatHint: keyFormatHint(value, { agentKeyPrefix, agentKeyFormat, developerKeyFormat, startsWithBearer, hasWhitespace }),
  };
}

function keyFormatHint(
  value: string,
  flags: Pick<FloeKeyInfo, "agentKeyPrefix" | "agentKeyFormat" | "developerKeyFormat" | "startsWithBearer" | "hasWhitespace">,
): string | undefined {
  if (!value) {
    return "No Floe agent key was loaded. Set FLOE_KEY, or set FLOE_AGENT_NAME plus the matching floe-agent fallback env var.";
  }

  if (flags.agentKeyFormat) {
    return undefined;
  }

  if (flags.developerKeyFormat) {
    return "This is a developer key. Floe x402 estimate/payment calls should use an agent key from the floe_* Agent keys section.";
  }

  if (flags.startsWithBearer) {
    return "Store only the raw key in .env, without the 'Bearer ' prefix.";
  }

  if (flags.hasWhitespace) {
    return "The key contains whitespace; remove pasted spaces or line breaks.";
  }

  if (flags.agentKeyPrefix) {
    return "This looks like a floe_* agent key by prefix, but Floe rejected it. The dashboard list shows only a saved prefix; if you no longer have the one-time plaintext key, rotate the active agent key and copy the newly shown full value into .env.";
  }

  return "Loaded key does not look like a Floe agent key. Use a raw floe_* agent key from the Agent keys section.";
}

function redact(value: string): string {
  if (!value) {
    return "";
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
