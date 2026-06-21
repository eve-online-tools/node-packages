export const sortedDict = (key: string, value: unknown): unknown =>
  value instanceof Object && !Array.isArray(value)
    ? Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((sorted, sortedKey) => {
          sorted[sortedKey] = (value as Record<string, unknown>)[sortedKey];
          return sorted;
        }, {})
    : value;

export const formatSpec = (spec: unknown): string =>
  `${JSON.stringify(spec, sortedDict, 2)}\n`;

type OpenApiParameter = {
  $ref?: string;
  in?: string;
  name?: string;
};

const PARAM_REFS_TO_STRIP = new Set([
  "#/components/parameters/CompatibilityDate",
  "#/components/parameters/Tenant",
]);

const HEADER_NAMES_TO_STRIP = new Set(["X-Compatibility-Date", "X-Tenant"]);

const shouldStripParameter = (param: OpenApiParameter): boolean => {
  if (param.$ref && PARAM_REFS_TO_STRIP.has(param.$ref)) {
    return true;
  }

  return (
    param.in === "header" &&
    !!param.name &&
    HEADER_NAMES_TO_STRIP.has(param.name)
  );
};

const stripParametersArray = (item: { parameters?: unknown[] }): void => {
  if (!Array.isArray(item.parameters)) {
    return;
  }

  item.parameters = item.parameters.filter(
    (param) => !shouldStripParameter(param as OpenApiParameter),
  );
};

/** Remove global client headers from operations; the ESI client sets these at init. */
export const stripGlobalHeaders = (spec: Record<string, unknown>): void => {
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) {
    return;
  }

  for (const pathItem of Object.values(paths)) {
    stripParametersArray(pathItem);

    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === "object") {
        stripParametersArray(operation as { parameters?: unknown[] });
      }
    }
  }
};

export const extractBaseUrlFromSpec = (
  spec: Record<string, unknown>,
  fallbackBaseUrl: string,
): { baseUrl: string; usedFallback: boolean } => {
  const servers = spec.servers as Array<{ url?: string }> | undefined;
  const url = servers?.[0]?.url?.trim();

  if (url) {
    return { baseUrl: url, usedFallback: false };
  }

  return { baseUrl: fallbackBaseUrl, usedFallback: true };
};
