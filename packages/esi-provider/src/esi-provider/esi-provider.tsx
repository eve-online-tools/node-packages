import {
  type PropsWithChildren,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from "react";
import createClient, { type Client } from "openapi-fetch";
import { esiBaseUrl, esiCompatibilityDate, esiTenant } from "./config";
import { context } from "./context";
import {
  combineInitialState,
  createRootReducer,
  wrapMiddleware,
} from "./middleware";
import { buildUserAgent } from "./user-agent";
import type { Middleware } from "./types";

export type PropsWithDefaults<TProps, TDefaults extends Partial<TProps>> = Omit<
  TProps,
  keyof TDefaults
> &
  Required<Pick<TProps, Extract<keyof TDefaults, keyof TProps>>>;

export interface NewProviderProps {
  baseUrl?: string;
  compatibilityDate?: string;
  fetch?: typeof fetch;
  tenant?: string;
  middleware?: Array<Middleware>;

  appName: string;
  appVersion: string;
  appContact: string | Array<string>;
}

const defaultProps = {
  baseUrl: esiBaseUrl,
  compatibilityDate: esiCompatibilityDate,
  tenant: esiTenant,
  middleware: [],
} satisfies Partial<NewProviderProps>;

export type CreateProviderResult<Paths extends {}> = [
  Provider: React.FC<PropsWithChildren>,
  useESIClient: () => Client<Paths, "application/json">,
];

/**
 * Create a new ESIProvider
 * @param props The properties for the ESIProvider
 * @returns The ESIProvider component and the useESIClient hook
 */
export const createESIProvider = <Paths extends {}>(
  props: NewProviderProps,
): CreateProviderResult<Paths> => {
  const {
    baseUrl,
    compatibilityDate,
    fetch,
    tenant,
    appName,
    appVersion,
    appContact,
    middleware,
  } = {
    ...defaultProps,
    ...props,
  } as PropsWithDefaults<NewProviderProps, typeof defaultProps>;

  const userAgent = buildUserAgent(appName, appVersion, appContact);
  const initialState = combineInitialState(middleware);
  const reducer = createRootReducer(middleware);

  const Provider = ({ children }: PropsWithChildren) => {
    const parentCtx = useContext(context);
    if (parentCtx) {
      throw new Error("ESIProvider is already mounted");
    }

    const [state, dispatch] = useReducer(reducer, initialState);
    const stateRef = useRef(state);
    stateRef.current = state;

    const client = useMemo(() => {
      const esiClient = createClient<Paths, "application/json">({
        baseUrl,
        fetch,
        headers: {
          "App-Name": appName,
          "App-Version": appVersion,
          "User-Agent": userAgent,
          "X-Compatibility-Date": compatibilityDate,
          "X-Tenant": tenant,
        },
      });

      // Wrap each middleware to give them access to their own state and dispatcher.
      const wrappedMiddleware = middleware.map((mw) =>
        wrapMiddleware(mw, {
          dispatch: (action) =>
            dispatch({
              type: [mw.key, action.type],
              payload: action.payload,
            }),
          getState: () =>
            (stateRef.current[mw.key] as typeof mw.initialState) ??
            mw.initialState,
        }),
      );

      esiClient.use(...wrappedMiddleware);
      return esiClient;
    }, [
      baseUrl,
      compatibilityDate,
      fetch,
      tenant,
      appName,
      appVersion,
      userAgent,
      middleware,
      dispatch,
    ]);

    return (
      <context.Provider value={{ client, middleware, state }}>
        {children}
      </context.Provider>
    );
  };

  const useESIClient = (): Client<Paths, "application/json"> => {
    const ctx = useContext(context);
    if (!ctx) {
      throw new Error("useESIClient must be used within a ESIProvider");
    }
    return ctx.client as Client<Paths, "application/json">;
  };

  return [Provider, useESIClient];
};
