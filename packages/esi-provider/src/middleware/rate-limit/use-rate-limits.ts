import { useMemo } from "react";
import { useMiddleware, useMiddlewareState } from "../../esi-provider/use-has-middleware";
import { RATE_LIMIT_MIDDLEWARE_KEY, type RateLimitState, type RateLimitsView } from "./types";
import { buildRateLimitsView } from "./utils";

export const useRateLimits = (): RateLimitsView | undefined => {
  const middleware = useMiddleware(RATE_LIMIT_MIDDLEWARE_KEY);
  const state = useMiddlewareState<RateLimitState>(RATE_LIMIT_MIDDLEWARE_KEY);

  return useMemo(() => {
    if (!middleware) {
      return undefined;
    }
    return buildRateLimitsView(state);
  }, [middleware, state]);
};
