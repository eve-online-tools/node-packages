import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  esiBaseUrl,
  esiCompatibilityDateUrl,
  esiSpecUrl,
} from "./constants";

type CompatibilityDatesResponse = {
  compatibility_dates: string[];
};

const moduleDir = dirname(fileURLToPath(import.meta.url));

const packageJsonPath = [
  join(moduleDir, "..", "package.json"),
  join(moduleDir, "..", "..", "..", "package.json"),
].find((path) => existsSync(path));

if (!packageJsonPath) {
  throw new Error("Could not locate @eve-online-tools/esi-provider package.json.");
}

const { name, version } = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  name: string;
  version: string;
};

export const getEsiUrl = (path: string): string => `${esiBaseUrl}${path}`;

export const buildCliUserAgent = (): string =>
  `${name}/${version} (esi-provider CLI)`;

export const buildHeaders = (
  options: { compatibilityDate?: string } = {},
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": buildCliUserAgent(),
  };

  if (options.compatibilityDate) {
    headers["X-Compatibility-Date"] = options.compatibilityDate;
  }

  return headers;
};

export const fetchLatestCompatibilityDate = async (): Promise<string> => {
  const response = await fetch(getEsiUrl(esiCompatibilityDateUrl), {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch compatibility dates (${response.status} ${response.statusText}).`,
    );
  }

  const { compatibility_dates: compatibilityDates } =
    (await response.json()) as CompatibilityDatesResponse;

  if (!compatibilityDates?.length) {
    throw new Error("No compatibility dates returned from ESI.");
  }

  return [...compatibilityDates].sort().at(-1)!;
};

export const fetchOpenApiSpec = async (
  compatibilityDate: string,
): Promise<unknown> => {
  const response = await fetch(getEsiUrl(esiSpecUrl), {
    headers: buildHeaders({ compatibilityDate }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec (${response.status} ${response.statusText}).`,
    );
  }

  return response.json();
};
