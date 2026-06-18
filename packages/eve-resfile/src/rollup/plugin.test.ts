import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { eveResfile } from "./plugin";

const getHook = <T extends (...args: never[]) => unknown>(
  hook: T | { handler: T } | undefined,
): T | undefined => {
  if (!hook) {
    return undefined;
  }
  if (typeof hook === "function") {
    return hook;
  }
  return hook.handler;
};

describe("rollup plugin", () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "eve-resfile-rollup-"));
  });

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("resolves res imports and emits asset modules", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);

        if (href.endsWith("/eveonline_123456.txt")) {
          return new Response("app:/resfileindex.txt,resindex/resfileindex.txt,hash");
        }

        if (href.endsWith("/resindex/resfileindex.txt")) {
          return new Response("res:/icons/64/icon.png,icons/icon_123.png,hash");
        }

        if (href.endsWith("/icons/icon_123.png")) {
          return new Response(Buffer.from("png-bytes"));
        }

        throw new Error(`Unexpected fetch: ${href}`);
      }),
    );

    const plugin = eveResfile({ buildNumber: "123456", cacheDir, root: cacheDir });
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
      emitFile: vi.fn(() => "asset-ref"),
    };

    await getHook(plugin.buildStart)?.call(context as never, {} as never);

    const resolvedId = await getHook(plugin.resolveId)?.call(
      context as never,
      "res:/icons/64/icon.png",
      undefined,
      { attributes: {}, isEntry: false } as never,
    );
    expect(resolvedId).toContain("res:/icons/64/icon.png");

    const moduleSource = await getHook(plugin.load)?.call(context as never, resolvedId as string);
    expect(moduleSource).toBe("export default import.meta.ROLLUP_FILE_URL_asset-ref");
    expect(context.emitFile).toHaveBeenCalledWith({
      type: "asset",
      name: "icon.png",
      source: Buffer.from("png-bytes"),
    });
  });
});
