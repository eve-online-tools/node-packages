import type { MiddlewareCallbackParams } from "openapi-fetch";

export type MiddlewareAction<TPayload = unknown> = {
  type: string;
  payload?: TPayload;
};

export type MiddlewareDispatch = (action: MiddlewareAction) => void;

export type MiddlewareContext<TState> = {
  dispatch: MiddlewareDispatch;
  getState: () => TState;
};

export type MiddlewareOnRequest<TState> = (
  options: MiddlewareCallbackParams & MiddlewareContext<TState>,
) =>
  | void
  | Request
  | Response
  | undefined
  | Promise<Request | Response | undefined | void>;

export type MiddlewareOnResponse<TState> = (
  options: MiddlewareCallbackParams & { response: Response } & MiddlewareContext<TState>,
) => void | Response | undefined | Promise<Response | undefined | void>;

export type MiddlewareOnError<TState> = (
  options: MiddlewareCallbackParams & { error: unknown } & MiddlewareContext<TState>,
) => void | Response | Error | Promise<void | Response | Error>;

export type Middleware<TState = unknown> =
  | {
      key: string;
      initialState: TState;
      reducer: (state: TState, action: MiddlewareAction) => TState;
      onRequest: MiddlewareOnRequest<TState>;
      onResponse?: MiddlewareOnResponse<TState>;
      onError?: MiddlewareOnError<TState>;
    }
  | {
      key: string;
      initialState: TState;
      reducer: (state: TState, action: MiddlewareAction) => TState;
      onRequest?: MiddlewareOnRequest<TState>;
      onResponse: MiddlewareOnResponse<TState>;
      onError?: MiddlewareOnError<TState>;
    }
  | {
      key: string;
      initialState: TState;
      reducer: (state: TState, action: MiddlewareAction) => TState;
      onRequest?: MiddlewareOnRequest<TState>;
      onResponse?: MiddlewareOnResponse<TState>;
      onError: MiddlewareOnError<TState>;
    };

export type CombinedMiddlewareState = Record<string, unknown>;

export type RootAction = {
  type: [middlewareKey: string, actionType: string];
  payload?: unknown;
};
