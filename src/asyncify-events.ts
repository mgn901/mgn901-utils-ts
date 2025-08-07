import type { NominalPrimitive } from './nominal-primitive.type';
import { type Id, generateId } from './random-values.js';

const messageTypeSymbol = Symbol();

interface Request<TArgs extends unknown[]> {
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly args: Readonly<TArgs>;
}

interface Response<TReturned> {
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly returned: TReturned;
}

type AsyncifyEventsPort = {
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

/**
 * Returns a {@linkcode Client} function that can be used to call functions on a server.
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
 */
export const clientFromPort = <
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
>(
  port: AsyncifyEventsPort,
): Client<TFunc, TArgs, TReturned> => {
  const pendingCallbacks = new Map<
    Request<TArgs>['id'],
    [resolve: (response: Awaited<TReturned>) => void, reject: (error: Error) => void]
  >();

  let suspend: (() => void) | undefined;

  const handleAllResponses = (response: Response<Awaited<TReturned>>): void => {
    const item = pendingCallbacks.get(response.id);
    pendingCallbacks.delete(response.id);
    item?.[0](response.returned);
    if (pendingCallbacks.size === 0) {
      suspend?.();
      suspend = undefined;
    }
  };

  return (...args) => {
    if (suspend === undefined) {
      suspend = port.listen<Response<Awaited<TReturned>>>(handleAllResponses);
    }

    const request = { id: generateId() as Request<TArgs>['id'], args } satisfies Request<TArgs>;
    const promise = new Promise<Awaited<TReturned>>((resolve, reject) => {
      pendingCallbacks.set(request.id, [resolve, reject]);
      port.send(request);
    });

    return promise;
  };
};

/**
 * Start a server that can be used to handle function calls from a {@linkcode Client}.
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
 * @returns A function that can be called to stop the server.
 */
export const startServerFromPort = <
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
>(
  func: TFunc,
  port: AsyncifyEventsPort,
): (() => void) =>
  port.listen<Request<TArgs>>(async (request) => {
    const returned = await func(...request.args);
    port.send<Response<TReturned>>({ id: request.id, returned });
  });

export const portFromEventTarget = (me: EventTarget, other: EventTarget): AsyncifyEventsPort => ({
  send: <TRequest>(request: TRequest) => {
    other.dispatchEvent(new MessageEvent('message', { data: request }));
  },

  listen: <TResponse>(handleResponse: (this: unknown, response: TResponse) => void) => {
    const handleMessage = (event: Event | MessageEvent<TResponse>) => {
      if (event instanceof MessageEvent) {
        handleResponse(event.data as TResponse);
      }
    };

    me.addEventListener('message', handleMessage);

    return () => {
      me.removeEventListener('message', handleMessage);
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
    messagePort.postMessage({ channel, body: request });
  },

  listen: <TResponse>(handleResponse: (this: unknown, response: TResponse) => void) => {
    const handleMessage = (event: Event | MessageEvent<TResponse>) => {
      if (event instanceof MessageEvent && event.data.channel === channel) {
        handleResponse(event.data.body as TResponse);
      }
    };

    messagePort.addEventListener('message', handleMessage);

    return () => {
      messagePort.removeEventListener('message', handleMessage);
    };
  },
});
