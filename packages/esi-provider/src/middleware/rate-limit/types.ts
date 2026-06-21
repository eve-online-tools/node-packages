export const RATE_LIMIT_MIDDLEWARE_KEY = "rateLimit";

export type RateLimitBucket = {
  remaining: number;
  maxTokens: number;
  windowMs: number;
  windowLabel: string;
  updatedAt: number;
};

/** group → rateLimitKey (subject) → bucket snapshot */
export type RateLimitBuckets = Record<string, Record<string, RateLimitBucket>>;

export type RateLimitState = {
  buckets: RateLimitBuckets;
  pathGroups: Record<string, string>;
};

export type SetBucketPayload = {
  rateLimitKey: string;
  group: string;
  remaining: number;
  maxTokens: number;
  windowMs: number;
  windowLabel: string;
  updatedAt: number;
};

export type SetPathGroupPayload = {
  schemaPath: string;
  group: string;
};

export type RateLimitBucketView = {
  rateLimitKey: string;
  remaining: number;
  estimatedRemaining: number;
  used: number;
  usage: number;
  updatedAt: number;
};

export type RateLimitGroupView = {
  group: string;
  limit: string;
  maxTokens: number;
  windowMs: number;
  windowLabel: string;
  buckets: RateLimitBucketView[];
  paths: string[];
};

export type RateLimitsView = {
  groups: RateLimitGroupView[];
  updatedAt: number;
};

export type ParsedRateLimitLimit = {
  maxTokens: number;
  windowMs: number;
  windowLabel: string;
};

export type BucketUsage = {
  estimatedRemaining: number;
  used: number;
  usage: number;
};
