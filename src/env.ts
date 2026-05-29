import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type EnvLoadRecord = {
  key: string;
  value: string;
  source: ".env";
  applied: boolean;
  reason?: string;
};

export const envLoadRecords = loadDotEnv();

function loadDotEnv(path = ".env"): EnvLoadRecord[] {
  const filePath = resolve(process.cwd(), path);
  if (!existsSync(filePath)) {
    return [];
  }

  const records: EnvLoadRecord[] = [];
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    const value = unquote(rawValue);
    if (process.env[key] !== undefined) {
      records.push({ key, value, source: ".env", applied: false, reason: "shell-env-already-set" });
      continue;
    }

    process.env[key] = value;
    records.push({ key, value, source: ".env", applied: true });
  }

  return records;
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
