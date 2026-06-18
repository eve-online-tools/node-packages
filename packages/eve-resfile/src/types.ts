export type EveResfileOptions = {
  /** Pin to a specific client build; omit to fetch latest from eveclient_TQ.json */
  buildNumber?: number | string;
  /** Override index CDN (default: https://binaries.eveonline.com) */
  indexOrigin?: string;
  /** Override asset CDN (default: https://resources.eveonline.com) */
  assetOrigin?: string;
  /** Cache dir relative to project root, or an absolute path (default: .cache/eve-resfile) */
  cacheDir?: string;
  /** Project root for resolving cacheDir (Rollup, or when not using the Vite plugin) */
  root?: string;
};

export type ResolvedEveResfileOptions = {
  buildNumber?: number | string;
  indexOrigin: string;
  assetOrigin: string;
  /** Absolute cache directory path */
  cacheDir: string;
};

export type ResfileIndex = {
  buildNumber: string;
  resPathToCdnPath: Map<string, string>;
};

export type EveClientManifest = {
  buildNumber: string;
};
