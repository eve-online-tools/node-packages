import type { Connect, Plugin } from "vite";

import { contentTypeForPath } from "../content-type";
import { DEFAULT_ASSET_ORIGIN, DEV_PROXY_PREFIX } from "../constants";
import { fetchBuffer } from "../fetch";
import { loadResfileIndexData } from "../index-loader";
import { resPathFromDevProxyUrl } from "../lookup";
import {
  isVirtualResId,
  loadResfileAssetModule,
  lookupOrThrow,
  resolveEveResfileOptions,
  resolveResfileId,
  resPathFromVirtualId,
} from "../plugin-core";
import type { EveResfileOptions, ResfileIndex, ResolvedEveResfileOptions } from "../types";

const createDevProxyMiddleware = (
  ensureIndex: () => Promise<ResfileIndex>,
  assetOrigin: string,
): Connect.NextHandleFunction => {
  return async (req, res, next) => {
    if (!req.url || req.method !== "GET") {
      next();
      return;
    }

    const pathname = new URL(req.url, "http://localhost").pathname;
    if (!pathname.startsWith(DEV_PROXY_PREFIX)) {
      next();
      return;
    }

    const resPath = resPathFromDevProxyUrl(pathname);
    if (!resPath) {
      res.statusCode = 400;
      res.end("Invalid resfile proxy path.");
      return;
    }

    let cdnPath: string;
    try {
      const index = await ensureIndex();
      cdnPath = lookupOrThrow(index, resPath);
    } catch (error) {
      res.statusCode = 404;
      res.end(error instanceof Error ? error.message : "Resfile not found.");
      return;
    }

    try {
      const buffer = await fetchBuffer(`${assetOrigin}/${cdnPath}`);
      res.statusCode = 200;
      res.setHeader("Content-Type", contentTypeForPath(resPath));
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(buffer);
    } catch (error) {
      res.statusCode = 502;
      res.end(error instanceof Error ? error.message : "Failed to fetch resfile from CDN.");
    }
  };
};

export const eveResfile = (options: EveResfileOptions = {}): Plugin => {
  let resolvedOptions: ResolvedEveResfileOptions | null = null;
  let indexPromise: Promise<ResfileIndex> | null = null;
  let loadedIndex: ResfileIndex | null = null;

  const ensureIndex = (): Promise<ResfileIndex> => {
    if (!resolvedOptions) {
      throw new Error("@eve-online-tools/eve-resfile/vite: configResolved has not run yet.");
    }

    indexPromise ??= loadResfileIndexData(resolvedOptions).then((index) => {
      loadedIndex = index;
      return index;
    });
    return indexPromise;
  };

  return {
    name: "eve-resfile-vite",
    enforce: "pre",

    configResolved(config) {
      resolvedOptions = resolveEveResfileOptions(options, config.root);
    },

    async buildStart() {
      const index = await ensureIndex();
      this.info(
        `Loaded EVE resfileindex (build ${index.buildNumber}, ${index.resPathToCdnPath.size} entries).`,
      );
    },

    configureServer: {
      order: "pre",
      handler(server) {
        server.middlewares.use(
          createDevProxyMiddleware(
            ensureIndex,
            resolvedOptions?.assetOrigin ?? DEFAULT_ASSET_ORIGIN,
          ),
        );
      },
    },

    resolveId(source) {
      return resolveResfileId(source);
    },

    async load(id) {
      if (!isVirtualResId(id)) {
        return null;
      }
      if (!resolvedOptions) {
        throw new Error("@eve-online-tools/eve-resfile/vite: configResolved has not run yet.");
      }

      const resPath = resPathFromVirtualId(id);
      const index = loadedIndex ?? (await ensureIndex());

      return loadResfileAssetModule({
        watchMode: this.meta.watchMode,
        assetOrigin: resolvedOptions.assetOrigin,
        index,
        resPath,
        emitAsset: (name, source) =>
          this.emitFile({
            type: "asset",
            name,
            source,
          }),
      });
    },
  };
};

export type { EveResfileOptions } from "../types";
