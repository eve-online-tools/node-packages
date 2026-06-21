import type { Middleware as FetchMiddleware } from "openapi-fetch";
import type {
  CombinedMiddlewareState,
  Middleware,
  MiddlewareContext,
  RootAction,
} from "./types";

export const assertUniqueMiddlewareKeys = (middleware: Array<Middleware>): void => {
  const seen = new Set<string>();
  for (const entry of middleware) {
    if (seen.has(entry.key)) {
      throw new Error(`Duplicate middleware key "${entry.key}"`);
    }
    seen.add(entry.key);
  }
};

export const combineInitialState = (
  middleware: Array<Middleware>,
): CombinedMiddlewareState => {
  assertUniqueMiddlewareKeys(middleware);
  return middleware.reduce<CombinedMiddlewareState>((acc, mw) => {
    acc[mw.key] = mw.initialState;
    return acc;
  }, {});
};

export const createRootReducer = (middleware: Array<Middleware>) => {
  assertUniqueMiddlewareKeys(middleware);
  return (state: CombinedMiddlewareState, action: RootAction): CombinedMiddlewareState => {
    const [middlewareKey, actionType] = action.type;
    const mw = middleware.find((entry) => entry.key === middlewareKey);
    if (!mw) {
      throw new Error(`Middleware "${middlewareKey}" not found`);
    }

    const slice = state[middlewareKey] ?? mw.initialState;
    const nextSlice = mw.reducer(slice as typeof mw.initialState, {
      type: actionType,
      payload: action.payload,
    });

    return {
      ...state,
      [middlewareKey]: nextSlice,
    };
  };
};

export const wrapMiddleware = <TState>(
  middleware: Middleware<TState>,
  ctx: MiddlewareContext<TState>,
): FetchMiddleware => {
  const { onRequest, onResponse, onError } = middleware;

  return {
    onRequest: onRequest
      ? (options) => onRequest({ ...options, ...ctx })
      : undefined,
    onResponse: onResponse
      ? (options) => onResponse({ ...options, ...ctx })
      : undefined,
    onError: onError ? (options) => onError({ ...options, ...ctx }) : undefined,
  } as FetchMiddleware;
};
