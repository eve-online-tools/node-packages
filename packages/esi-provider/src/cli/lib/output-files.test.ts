import { describe, expect, it } from "vitest";

import { generateIndexTs } from "./output-files";
import { extractBaseUrlFromSpec, stripGlobalHeaders } from "./spec";

describe("stripGlobalHeaders", () => {
  it("removes compatibility and tenant parameter refs and inline headers", () => {
    const spec = {
      paths: {
        "/status/": {
          parameters: [
            { $ref: "#/components/parameters/CompatibilityDate" },
            { $ref: "#/components/parameters/Tenant" },
            { name: "datasource", in: "query" },
          ],
          get: {
            parameters: [
              { in: "header", name: "X-Compatibility-Date" },
              { in: "header", name: "X-Tenant" },
              { name: "language", in: "query" },
            ],
          },
        },
      },
    };

    stripGlobalHeaders(spec);

    expect(spec.paths["/status/"].parameters).toEqual([
      { name: "datasource", in: "query" },
    ]);
    expect(spec.paths["/status/"].get.parameters).toEqual([
      { name: "language", in: "query" },
    ]);
  });
});

describe("extractBaseUrlFromSpec", () => {
  it("reads servers[0].url from the spec", () => {
    expect(
      extractBaseUrlFromSpec(
        { servers: [{ url: "https://esi.evetech.net" }] },
        "https://fallback.example",
      ),
    ).toEqual({
      baseUrl: "https://esi.evetech.net",
      usedFallback: false,
    });
  });

  it("falls back when servers are missing", () => {
    expect(extractBaseUrlFromSpec({}, "https://fallback.example")).toEqual({
      baseUrl: "https://fallback.example",
      usedFallback: true,
    });
  });
});

describe("generateIndexTs", () => {
  it("includes editable banner, baseUrl, and createESIProvider helper", () => {
    const content = generateIndexTs(
      { servers: [{ url: "https://esi.evetech.net" }] },
      "https://fallback.example",
    );

    expect(content).toContain("safe to edit");
    expect(content).toContain('const baseUrl = "https://esi.evetech.net";');
    expect(content).toContain("export const createESIProvider");
    expect(content).toContain("CreateProviderResult<paths>");
    expect(content).toContain('from "@eve-online-tools/esi-provider"');
  });

  it("uses fallback baseUrl when servers are missing", () => {
    const content = generateIndexTs({}, "https://fallback.example");

    expect(content).toContain('const baseUrl = "https://fallback.example";');
  });
});
