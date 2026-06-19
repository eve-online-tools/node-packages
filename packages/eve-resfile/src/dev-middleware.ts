import { contentTypeForPath } from "./content-type";
import { DEV_PROXY_PREFIX } from "./constants";
import { fetchBuffer } from "./fetch";
import { resPathFromDevProxyUrl } from "./lookup";
import { lookupOrThrow } from "./plugin-core";
import type { ResfileIndex } from "./types";

type DevServerRequest = {
  url?: string;
  method?: string;
};

type DevServerResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string | Buffer): void;
};

type DevServerNext = () => void;

export type DevProxyMiddleware = (
  req: DevServerRequest,
  res: DevServerResponse,
  next: DevServerNext,
) => void | Promise<void>;

export const createDevProxyMiddleware = (
  ensureIndex: () => Promise<ResfileIndex>,
  assetOrigin: string,
): DevProxyMiddleware => {
  return async (req, res, next) => {
    if (!req.url || req.method !== "GET") {
      next();
      return;
    }

    const pathname = req.url.split(/[?#]/)[0] ?? req.url;
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
