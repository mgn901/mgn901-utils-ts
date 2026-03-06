import type { NominalPrimitive } from './nominal-primitive.type';
import { generateId, type Id } from './random-values.js';
import { defineRouter } from './router-utils.js';

const messageTypeSymbol = Symbol();

/** @internal */
type Request<TArgs extends unknown[]> = {
  readonly type: 'request';
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly args: Readonly<TArgs>;
};

/** @internal */
type AbortRequest = {
  readonly type: 'abortRequest';
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly reason: unknown;
};

/** @internal */
type Response<TReturned> = {
  readonly type: 'response';
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly value: TReturned;
};

/** @internal */
type ErrorResponse = {
  readonly type: 'errorResponse';
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly value: unknown;
};

export type AbortableFunction<TArgs extends unknown[], TReturned> = (
  this: unknown,
  args: TArgs,
  abortSignal?: AbortSignal,
) => TReturned;

export type AsyncifyEventsPort = {
  send<TRequest>(this: unknown, request: TRequest): void;
  listen<TResponse>(
    this: unknown,
    handleResponse: (this: unknown, response: TResponse) => void,
  ): () => void;
};

export type Client<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> = (...args: Readonly<TArgs>) => Promise<Awaited<TReturned>>;

export type AbortableClient<
  TFunc extends AbortableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = ReturnType<TFunc>,
> = (
  args: Readonly<TArgs>,
  abortSignal?: AbortSignal,
) => Promise<Awaited<TReturned>>;

/**
 * Returns a {@linkcode Client} function that can be used to call functions on a server.
 *
 * `asyncify-events` allows you to call functions on a `WebWorker`, `ServiceWorker` as if they were local functions.
 * By calling the client function, it sends a request to the *server* (e.g. `WebWorker` or `ServiceWorker`) and returns a Promise that resolves with the result of the function call.
 * If the function on the server fails, the Promise will be rejected with the error thrown on the server.
 *
 * ## Example (Web Worker as a Server)
 *
 * ### Web Worker side
 *
 * ```ts
 * import { startServerFromPort, portFromMessagePort } from '@mgn901/mgn901-utils-ts/asyncify-events';
 *
 * // define a function
 * export const add = (arg1: number, arg2: number) => arg1 + arg2;
 *
 * // setup a server
 * startServerFromPort(add, portFromMessagePort(globalThis, 'my-channel'));
 * ```
 *
 * ### Window side
 *
 * ```ts
 * import { clientFromPort, portFromMessagePort } from '@mgn901/mgn901-utils-ts/asyncify-events';
 * import type { add } from './worker.js';
 *
 * // setup a client
 * const worker = new Worker('worker.js');
 * const request = clientFromPort<typeof add>(
 *   portFromMessagePort(worker, 'my-channel')
 * );
 *
 * // call a function on the worker
 * request(1, 2).then((result) => {
 *   console.log(result); // => 3
 * });
 * ```
 *
 * @returns A {@linkcode Client} function that can be used to call functions on a server.
 *
 * @see {@linkcode startServerFromPort}
 */
export const clientFromPort = <
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
>(
  port: AsyncifyEventsPort,
): Client<TFunc, TArgs, TReturned> => {
  const underlyingAbortableClient = abortableClientFromPort<
    AbortableFunction<TArgs, TReturned>,
    TArgs,
    TReturned
  >(port);

  // underlyingAbortableClientをAbortableClient未指定で呼び出す。
  return (...args) => underlyingAbortableClient(args);
};

/**
 * Returns an {@linkcode AbortableClient} function that can be used to call functions on a server.
 *
 * If the function on the server is an {@linkcode AbortableFunction}, you can pass an `AbortSignal` when calling the client function, and stop execution on the server by dispatching `abort` event.
 *
 * @see {@linkcode clientFromPort} for detailed usage.
 */
export const abortableClientFromPort = <
  TFunc extends AbortableFunction<TArgs, TReturned>,
  TArgs extends unknown[] = Parameters<TFunc>[0],
  TReturned = ReturnType<TFunc>,
>(
  port: AsyncifyEventsPort,
): AbortableClient<TFunc, TArgs, TReturned> => {
  const pendingCallbacks = new Map<
    Request<TArgs>['id'],
    [
      resolve: (response: Awaited<TReturned>) => void,
      reject: (error: unknown) => void,
    ]
  >();
  const requestIdAbortSignalMap = new Map<Request<TArgs>['id'], AbortSignal>();
  const abortSignalRequestIdMap = new Map<AbortSignal, Request<TArgs>['id']>();

  let unlisten: (() => void) | undefined;

  // Client側のすべてのAbortSignalのabortイベントを処理する関数を定義する。
  const handleAllAbortEvents = (event: Event): void => {
    if (event.currentTarget instanceof AbortSignal === false) {
      return;
    }

    // AbortSignalから元のリクエストのIDを取得する。
    const id = abortSignalRequestIdMap.get(event.currentTarget);
    if (id === undefined) {
      return;
    }

    // ServerにAbortRequestを送信する。
    port.send<AbortRequest>({
      type: 'abortRequest',
      id,
      reason: event.currentTarget.reason,
    });

    // AbortSignalとリクエストIDの紐付けを解除する。
    // AbortRequest送信後にServerがエラーを吐く可能性があるので、resolve/rejectとリクエストIDの紐付けの解除はしない。
    requestIdAbortSignalMap.delete(id);
    abortSignalRequestIdMap.delete(event.currentTarget);
  };

  // ServerからのすべてのResponseを処理する関数を定義する。
  const handleAllResponses = (
    response: Response<Awaited<TReturned>> | ErrorResponse,
  ): void => {
    // AbortSignalとリクエストIDの紐付けを解除する。
    const abortSignal = requestIdAbortSignalMap.get(response.id);
    if (abortSignal !== undefined) {
      // リクエスト処理時に追加したAbortSignalのabortイベントリスナーも忘れずに削除する。
      abortSignal.removeEventListener('abort', handleAllAbortEvents);
      requestIdAbortSignalMap.delete(response.id);
      abortSignalRequestIdMap.delete(abortSignal);
    }

    // resolve/rejectを呼び出す。
    const callback = pendingCallbacks.get(response.id);
    if (response.type === 'errorResponse') {
      callback?.[1](response.value);
    } else {
      callback?.[0](response.value);
    }

    // resolve/rejectとリクエストIDの紐付けを解除する。
    pendingCallbacks.delete(response.id);

    // Response待ちのリクエストが無くなった場合はlistenを解除する。
    if (pendingCallbacks.size === 0) {
      unlisten?.();
      unlisten = undefined;
    }
  };

  // Clientの使用側からServerにリクエストを送信するための関数を定義する。
  return (args, abortSignal) => {
    // listenが解除済みの場合は再開する。
    if (unlisten === undefined) {
      unlisten = port.listen<Response<Awaited<TReturned>> | ErrorResponse>(
        handleAllResponses,
      );
    }

    const requestId = generateId() as Request<TArgs>['id'];

    // AbortSignalが指定されている場合は、abortイベントが来た際にその処理をするように設定する。
    // AbortSignalとリクエストIDの紐付けもする。
    if (abortSignal !== undefined) {
      abortSignal.addEventListener('abort', handleAllAbortEvents, {
        once: true,
      });
      requestIdAbortSignalMap.set(requestId, abortSignal);
      abortSignalRequestIdMap.set(abortSignal, requestId);
    }

    // Clientの使用側には、Serverの呼び出しをPromiseであるように見せる。
    return new Promise<Awaited<TReturned>>((resolve, reject) => {
      // Responseをresolve/rejectする処理は`handleAllResponses`に書いてある。
      // `handleAllResponses`できるようにresolve/rejectとリクエストIDを紐付ける。
      pendingCallbacks.set(requestId, [resolve, reject]);
      // Serverにリクエストを送信する。
      port.send<Request<TArgs>>({ type: 'request', id: requestId, args });
    });
  };
};

/**
 * Start a server that can be used to handle function calls from a {@linkcode Client}.
 *
 * @see {@linkcode clientFromPort} for detailed usage.
 * @returns A function that can be called to stop the server.
 */
export const startServerFromPort = <TArgs extends unknown[], TReturned>(
  func: (this: unknown, ...args: TArgs) => TReturned,
  port: AsyncifyEventsPort,
): (() => void) =>
  startAbortableServerFromPort<TArgs, TReturned>(
    (args: TArgs) => func(...args),
    port,
  );

/**
 * Start a server that can be used to handle function calls from a {@linkcode AbortableClient}.
 *
 * @see {@linkcode abortableClientFromPort} and {@linkcode clientFromPort} for detailed usage.
 * @returns A function that can be called to stop the server.
 */
export const startAbortableServerFromPort = <
  TArgs extends unknown[],
  TReturned,
>(
  func: AbortableFunction<TArgs, TReturned>,
  port: AsyncifyEventsPort,
): (() => void) => {
  const abortControllers = new Map<Request<TArgs>['id'], AbortController>();

  const handleRequest = async (request: Request<TArgs>) => {
    const abortController = new AbortController();
    abortControllers.set(request.id, abortController);
    try {
      const returned = await func(request.args, abortController.signal);
      port.send<Response<TReturned>>({
        type: 'response',
        id: request.id,
        value: returned,
      });
    } catch (error: unknown) {
      port.send<ErrorResponse>({
        type: 'errorResponse',
        id: request.id,
        value: error,
      });
    } finally {
      abortControllers.delete(request.id);
    }
  };

  const handleAbortRequest = (request: AbortRequest) => {
    const abortController = abortControllers.get(request.id);
    if (abortController === undefined) {
      return;
    }
    abortController.abort(request.reason);
    abortControllers.delete(request.id);
  };

  const handlers = { request: handleRequest, abortRequest: handleAbortRequest };
  const requestRouter = defineRouter(handlers, 'type');

  return port.listen<Request<TArgs> | AbortRequest>(requestRouter);
};

/** @internal */
export type PortMessage<TBody> = {
  readonly channel: string;
  readonly body: TBody;
};

export const portFromEventTarget = (params: {
  readonly me: EventTarget;
  readonly other: EventTarget;
  readonly channel: string;
}): AsyncifyEventsPort => ({
  send: <TRequest>(request: TRequest) => {
    const detail = {
      body: request,
      channel: params.channel,
    } satisfies PortMessage<TRequest>;
    params.other.dispatchEvent(
      new CustomEvent<PortMessage<TRequest>>('message', { detail }),
    );
  },

  listen: <TResponse>(
    handleResponse: (this: unknown, response: TResponse) => void,
  ) => {
    const handleMessage = (
      event: Event | CustomEvent<PortMessage<TResponse>>,
    ) => {
      if (
        event instanceof CustomEvent &&
        (event as CustomEvent<PortMessage<TResponse>>).detail.channel ===
          params.channel
      ) {
        handleResponse(
          (event as CustomEvent<PortMessage<TResponse>>).detail.body,
        );
      }
    };

    params.me.addEventListener('message', handleMessage);

    return () => {
      params.me.removeEventListener('message', handleMessage);
    };
  },
});

export const portFromMessagePort = (
  messagePort:
    | BroadcastChannel
    | DedicatedWorkerGlobalScope
    | MessagePort
    | ServiceWorker
    | Window
    | Worker,
  channel: string,
): AsyncifyEventsPort => ({
  send: <TRequest>(request: TRequest) => {
    const data = { channel, body: request } satisfies PortMessage<TRequest>;
    messagePort.postMessage(data);
  },

  listen: <TResponse>(
    handleResponse: (this: unknown, response: TResponse) => void,
  ) => {
    const handleMessage = (
      event: Event | MessageEvent<PortMessage<TResponse>>,
    ) => {
      if (
        event instanceof MessageEvent &&
        (event as MessageEvent<PortMessage<TResponse>>).data.channel === channel
      ) {
        handleResponse(
          (event as MessageEvent<PortMessage<TResponse>>).data.body,
        );
      }
    };

    messagePort.addEventListener('message', handleMessage);

    return () => {
      messagePort.removeEventListener('message', handleMessage);
    };
  },
});
