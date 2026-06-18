import {
  loadResfileAssetModule,
  lookupOrThrow,
  resolveResfileId,
  resPathFromVirtualId,
  virtualIdForResPath,
} from "./plugin-core";
import type { ResfileIndex } from "./types";

describe("plugin-core", () => {
  const index: ResfileIndex = {
    buildNumber: "123456",
    resPathToCdnPath: new Map([["res:/icons/64/icon.png", "icons/icon_123.png"]]),
  };

  it("resolves res imports to virtual module ids", () => {
    expect(resolveResfileId("res:/icons/64/icon.png")).toBe(
      virtualIdForResPath("res:/icons/64/icon.png"),
    );
    expect(resolveResfileId("./local-file.png")).toBeNull();
  });

  it("extracts res paths from virtual ids", () => {
    const virtualId = virtualIdForResPath("res:/icons/64/icon.png");
    expect(resPathFromVirtualId(virtualId)).toBe("res:/icons/64/icon.png");
  });

  it("throws when a res path is missing from the index", () => {
    expect(() => lookupOrThrow(index, "res:/missing.png")).toThrow(
      "res:/missing.png not found in resfileindex (build 123456).",
    );
  });

  it("returns dev proxy modules in watch mode", async () => {
    const moduleSource = await loadResfileAssetModule({
      watchMode: true,
      assetOrigin: "https://resources.test",
      index,
      resPath: "res:/icons/64/icon.png",
      emitAsset: () => "asset-ref",
    });

    expect(moduleSource).toBe('export default "/__eve_res__/icons%2F64%2Ficon.png"');
  });

  it("fetches assets and emits file references in build mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Buffer.from("png-bytes"))),
    );

    const moduleSource = await loadResfileAssetModule({
      watchMode: false,
      assetOrigin: "https://resources.test",
      index,
      resPath: "res:/icons/64/icon.png",
      emitAsset: (name, source) => {
        expect(name).toBe("icon.png");
        expect(source.toString()).toBe("png-bytes");
        return "asset-ref";
      },
    });

    expect(moduleSource).toBe("export default import.meta.ROLLUP_FILE_URL_asset-ref");
    vi.unstubAllGlobals();
  });
});
