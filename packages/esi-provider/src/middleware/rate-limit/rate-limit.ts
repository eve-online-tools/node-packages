import type { Middleware, MiddlewareAction } from '../../esi-provider/types'
import { BucketGate } from './concurrency'
import {
  RATE_LIMIT_MIDDLEWARE_KEY,
  type RateLimitState,
  type SetBucketPayload,
  type SetPathGroupPayload,
} from './types'
import {
  applyInFlightPenalty,
  calculateWaitMs,
  extractRateLimitKey,
  getBucket,
  parseRateLimitLimitHeader,
  sleep,
} from './utils'

const initialState: RateLimitState = {
  buckets: {},
  pathGroups: {},
}

const SET_BUCKET = 'setBucket'
const SET_PATH_GROUP = 'setPathGroup'

const DEFAULT_IN_FLIGHT_TOKEN_COST = 2

const reducer = (state: RateLimitState, action: MiddlewareAction): RateLimitState => {
  switch (action.type) {
    case SET_BUCKET: {
      const payload = action.payload as SetBucketPayload
      const groupBuckets = state.buckets[payload.group] ?? {}
      return {
        ...state,
        buckets: {
          ...state.buckets,
          [payload.group]: {
            ...groupBuckets,
            [payload.rateLimitKey]: {
              remaining: payload.remaining,
              maxTokens: payload.maxTokens,
              windowMs: payload.windowMs,
              windowLabel: payload.windowLabel,
              updatedAt: payload.updatedAt,
            },
          },
        },
      }
    }
    case SET_PATH_GROUP: {
      const payload = action.payload as SetPathGroupPayload
      return {
        ...state,
        pathGroups: {
          ...state.pathGroups,
          [payload.schemaPath]: payload.group,
        },
      }
    }
    default:
      return state
  }
}

export type RateLimitMiddlewareOptions = {
  minTokens?: number
  usageThreshold?: number
  /** Estimated token cost per in-flight request (ESI charges 2 for 2xx). */
  inFlightTokenCost?: number
}

export const createRateLimitMiddleware = (options: RateLimitMiddlewareOptions = {}): Middleware<RateLimitState> => {
  const minTokens = options.minTokens ?? 5
  const usageThreshold = options.usageThreshold ?? 0.5
  const inFlightTokenCost = options.inFlightTokenCost ?? DEFAULT_IN_FLIGHT_TOKEN_COST
  const gate = new BucketGate()

  return {
    key: RATE_LIMIT_MIDDLEWARE_KEY,
    initialState,
    reducer,
    onRequest: async ({ request, schemaPath, getState, id }) => {
      const rateLimitKey = extractRateLimitKey(request)
      const group = getState().pathGroups[schemaPath]
      if (!group) {
        return
      }

      const bucket = getBucket(getState().buckets, group, rateLimitKey)
      if (!bucket) {
        return
      }

      await gate.runWithBucket(id, group, rateLimitKey, async () => {
        const inFlight = gate.getInFlight(group, rateLimitKey)
        const adjustedBucket = applyInFlightPenalty(bucket, inFlight, inFlightTokenCost)
        const waitMs = calculateWaitMs(adjustedBucket, { minTokens, usageThreshold })
        if (waitMs > 0) {
          await sleep(waitMs)
        }
      })
    },
    onResponse: ({ request, schemaPath, response, dispatch, id }) => {
      gate.release(id)

      const group = response.headers.get('X-Ratelimit-Group')
      if (!group) {
        return
      }

      const limitHeader = response.headers.get('X-Ratelimit-Limit')
      const remainingHeader = response.headers.get('X-Ratelimit-Remaining')
      const parsedLimit = parseRateLimitLimitHeader(limitHeader)
      const remaining = Number(remainingHeader)

      if (!parsedLimit || !Number.isFinite(remaining)) {
        return
      }

      const rateLimitKey = extractRateLimitKey(request)
      const updatedAt = Date.now()

      dispatch({
        type: SET_PATH_GROUP,
        payload: { schemaPath, group },
      })

      dispatch({
        type: SET_BUCKET,
        payload: {
          rateLimitKey,
          group,
          remaining,
          maxTokens: parsedLimit.maxTokens,
          windowMs: parsedLimit.windowMs,
          windowLabel: parsedLimit.windowLabel,
          updatedAt,
        },
      })
    },
    onError: ({ id }) => {
      gate.release(id)
    },
  }
}
