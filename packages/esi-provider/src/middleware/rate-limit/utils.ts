import type {
  BucketUsage,
  ParsedRateLimitLimit,
  RateLimitBucket,
  RateLimitBucketView,
  RateLimitGroupView,
  RateLimitState,
  RateLimitsView,
} from "./types";

const GLOBAL_RATE_LIMIT_KEY = "global";

const LIMIT_HEADER_PATTERN = /^(\d+)\/(\d+)(s|m|h|d|y)$/;

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

export const getBucket = (
  buckets: RateLimitState["buckets"],
  group: string,
  rateLimitKey: string,
): RateLimitBucket | undefined => buckets[group]?.[rateLimitKey];

export const applyInFlightPenalty = (
  bucket: RateLimitBucket,
  inFlightCount: number,
  tokenCostPerRequest: number,
): RateLimitBucket => ({
  ...bucket,
  remaining: bucket.remaining - inFlightCount * tokenCostPerRequest,
});

export const parseSubIdentifier = (sub: string): string | null => {
  const parts = sub.split(":");
  if (parts.length !== 3) {
    return null;
  }
  return parts[2];
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const extractRateLimitKey = (request: Request): string => {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return GLOBAL_RATE_LIMIT_KEY;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return GLOBAL_RATE_LIMIT_KEY;
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== "string") {
    return GLOBAL_RATE_LIMIT_KEY;
  }

  const identifier = parseSubIdentifier(payload.sub);
  return identifier ?? GLOBAL_RATE_LIMIT_KEY;
};

export const parseRateLimitLimitHeader = (
  value: string | null,
): ParsedRateLimitLimit | null => {
  if (!value) {
    return null;
  }

  const match = LIMIT_HEADER_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const maxTokens = Number(match[1]);
  const windowAmount = Number(match[2]);
  const unit = match[3];
  const unitMs = UNIT_MS[unit];

  if (
    !Number.isFinite(maxTokens) ||
    !Number.isFinite(windowAmount) ||
    maxTokens <= 0 ||
    windowAmount <= 0
  ) {
    return null;
  }

  return {
    maxTokens,
    windowMs: windowAmount * unitMs,
    windowLabel: `${windowAmount}${unit}`,
  };
};

export const estimateBucketUsage = (
  bucket: RateLimitBucket,
  now = Date.now(),
): BucketUsage => {
  const elapsed = Math.max(0, now - bucket.updatedAt);
  const regenerated = elapsed * (bucket.maxTokens / bucket.windowMs);
  const estimatedRemaining = Math.min(bucket.maxTokens, bucket.remaining + regenerated);
  const used = bucket.maxTokens - estimatedRemaining;
  const usage = used / bucket.maxTokens;

  return { estimatedRemaining, used, usage };
};

export const calculateWaitMs = (
  bucket: RateLimitBucket,
  options: { minTokens?: number; usageThreshold?: number; now?: number } = {},
): number => {
  const minTokens = options.minTokens ?? 5;
  const usageThreshold = options.usageThreshold ?? 0.5;
  const now = options.now ?? Date.now();

  const { estimatedRemaining, usage } = estimateBucketUsage(bucket, now);
  const timePerToken = bucket.windowMs / bucket.maxTokens;

  if (estimatedRemaining < minTokens) {
    const tokensNeeded = minTokens - estimatedRemaining;
    return tokensNeeded * timePerToken;
  }

  if (usage > usageThreshold) {
    return usage * minTokens * timePerToken;
  }

  return 0;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const buildRateLimitsView = (
  state: RateLimitState,
  now = Date.now(),
): RateLimitsView => {
  const groupMap = new Map<string, RateLimitGroupView>();

  for (const [schemaPath, group] of Object.entries(state.pathGroups)) {
    const existing = groupMap.get(group);
    if (existing) {
      if (!existing.paths.includes(schemaPath)) {
        existing.paths.push(schemaPath);
      }
      continue;
    }

    groupMap.set(group, {
      group,
      limit: "",
      maxTokens: 0,
      windowMs: 0,
      windowLabel: "",
      buckets: [],
      paths: [schemaPath],
    });
  }

  for (const [group, subjectBuckets] of Object.entries(state.buckets)) {
    for (const [rateLimitKey, bucket] of Object.entries(subjectBuckets)) {
      const usage = estimateBucketUsage(bucket, now);

      let groupView = groupMap.get(group);
      if (!groupView) {
        groupView = {
          group,
          limit: "",
          maxTokens: 0,
          windowMs: 0,
          windowLabel: "",
          buckets: [],
          paths: [],
        };
        groupMap.set(group, groupView);
      }

      groupView.limit = `${bucket.maxTokens}/${bucket.windowLabel}`;
      groupView.maxTokens = bucket.maxTokens;
      groupView.windowMs = bucket.windowMs;
      groupView.windowLabel = bucket.windowLabel;

      groupView.buckets.push({
        rateLimitKey,
        remaining: bucket.remaining,
        estimatedRemaining: usage.estimatedRemaining,
        used: usage.used,
        usage: usage.usage,
        updatedAt: bucket.updatedAt,
      });
    }
  }

  const groups = Array.from(groupMap.values())
    .map((groupView) => ({
      ...groupView,
      paths: [...groupView.paths].sort(),
      buckets: [...groupView.buckets].sort((a, b) =>
        a.rateLimitKey.localeCompare(b.rateLimitKey),
      ),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));

  const updatedAt = groups.reduce(
    (max, groupView) =>
      Math.max(
        max,
        groupView.buckets.reduce((bucketMax, bucket) => Math.max(bucketMax, bucket.updatedAt), 0),
      ),
    0,
  );

  return { groups, updatedAt };
};

export const toBucketView = (
  bucket: RateLimitBucket,
  rateLimitKey: string,
  now = Date.now(),
): RateLimitBucketView => {
  const usage = estimateBucketUsage(bucket, now);
  return {
    rateLimitKey,
    remaining: bucket.remaining,
    estimatedRemaining: usage.estimatedRemaining,
    used: usage.used,
    usage: usage.usage,
    updatedAt: bucket.updatedAt,
  };
};
