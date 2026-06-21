import { useContext } from "react";
import { context } from "./context";
import type { Middleware } from "./types";

/**
 * Find a middleware by its key
 * @param key The middleware key to check for
 * @returns The middleware, or undefined if it is not found
 */
export const useMiddleware = <TMiddleware extends Middleware>(
  key: TMiddleware["key"],
): TMiddleware | undefined => {
  const ctx = useContext(context);
  if (!ctx) {
    throw new Error("useMiddleware must be used within a ESIProvider");
  }
  return ctx.middleware.find((m) => m.key === key) as TMiddleware | undefined;
};

/**
 * Read the current state slice for a middleware by key
 * @param key The middleware key
 * @returns The middleware state slice
 */
export const useMiddlewareState = <TState>(key: string): TState => {
  const ctx = useContext(context);
  if (!ctx) {
    throw new Error("useMiddlewareState must be used within a ESIProvider");
  }
  return ctx.state[key] as TState;
};
