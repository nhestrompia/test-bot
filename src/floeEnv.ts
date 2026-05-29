export type FloeCredential = {
  key: string;
  envName: string;
  agentName?: string;
};

const PRIMARY_ENV_NAMES = ["FLOE_KEY"] as const;
const CREDIT_API_HOST_ENV_SUFFIX = "CREDIT_API_FLOELABS_XYZ";

export function getFloeCredential(
  agentName?: string,
): FloeCredential | undefined {
  for (const envName of PRIMARY_ENV_NAMES) {
    const key = process.env[envName];
    if (key) {
      return { key, envName };
    }
  }

  const preferredAgentName = agentName ?? process.env.FLOE_AGENT_NAME;
  if (preferredAgentName) {
    const normalized = normalizeAgentNameForEnv(preferredAgentName);
    const scopedNames = [
      `FLOE_AGENT_KEY_${normalized}__${CREDIT_API_HOST_ENV_SUFFIX}`,
      `FLOE_AGENT_KEY_${normalized}`,
    ];
    for (const envName of scopedNames) {
      const key = process.env[envName];
      if (key) {
        return { key, envName, agentName: preferredAgentName };
      }
    }
  }

  const discovered = Object.entries(process.env)
    .filter(
      ([envName, value]) =>
        envName.startsWith("FLOE_AGENT_KEY_") && Boolean(value),
    )
    .sort(
      ([left], [right]) => scoreAgentEnvName(right) - scoreAgentEnvName(left),
    );

  const match = discovered[0];
  return match ? { envName: match[0], key: match[1] ?? "" } : undefined;
}

export function floeCredentialEnvNames(agentName?: string): string[] {
  const names: string[] = [...PRIMARY_ENV_NAMES];
  const preferredAgentName = agentName ?? process.env.FLOE_AGENT_NAME;
  if (preferredAgentName) {
    const normalized = normalizeAgentNameForEnv(preferredAgentName);
    names.push(`FLOE_AGENT_KEY_${normalized}__${CREDIT_API_HOST_ENV_SUFFIX}`);
    names.push(`FLOE_AGENT_KEY_${normalized}`);
  }

  for (const envName of Object.keys(process.env)) {
    if (envName.startsWith("FLOE_AGENT_KEY_") && !names.includes(envName)) {
      names.push(envName);
    }
  }

  return names;
}

export function normalizeAgentNameForEnv(agentName: string): string {
  return agentName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function scoreAgentEnvName(envName: string): number {
  return envName.endsWith(`__${CREDIT_API_HOST_ENV_SUFFIX}`) ? 1 : 0;
}
