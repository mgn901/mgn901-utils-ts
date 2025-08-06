import type { NominalPrimitive } from './nominal-primitive.type';
import { type Id, generateId } from './random-values.js';

const messageTypeSymbol = Symbol();

interface Request<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> {
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly args: Readonly<TArgs>;
}

interface Response<TReturned> {
  readonly id: NominalPrimitive<Id, typeof messageTypeSymbol>;
  readonly returned: TReturned;
}

/**
 * A client that can be used to call functions on a {@linkcode Server}.
 *
 * ## Example (Web Worker as a Server)
 *
 * ### Web Worker side
 *
 * ```ts
 * // define a function
 * export const add = (arg1: number, arg2: number) => arg1 + arg2;
 *
 * // setup a server
 * export const server = new Server({
 *   terminal: new MessagePortTerminal({ port: globalThis, channel: 'my-channel' }),
 *   func: add,
 * });
 * ```
 *
 * ### Window side
 *
 * ```ts
 * import { Client, MessagePortTerminal } from '@mgn901/mgn901-utils-ts/asyncify-events';
 * import type { server } from './worker.js';
 *
 * // setup a client
 * const worker = new Worker('worker.js');
 * const client = new Client<typeof server>({
 *   terminal: new MessagePortTerminal({ port: worker, channel: 'my-channel' }),
 * });
 *
 * // call a function on the server
 * client.request(1, 2).then((result) => {
 *   console.log(result); // => 3
 * });
 * ```
 */
export class Client<
  TServer extends Server<TFunc, TArgs, TReturned>,
  TArgs extends unknown[] = TServer extends Server<infer IFunc, infer IArgs, infer IReturned>
    ? IArgs
    : unknown,
  TReturned = TServer extends Server<infer IFunc, TArgs, infer IReturned> ? IReturned : unknown,
  TFunc extends (this: unknown, ...args: TArgs) => TReturned = TServer extends Server<
    infer IFunc,
    TArgs,
    TReturned
  >
    ? IFunc extends (this: unknown, ...args: TArgs) => TReturned
      ? IFunc
      : (this: unknown, ...args: TArgs) => TReturned
    : (this: unknown, ...args: TArgs) => TReturned,
> {
  private readonly terminal: Terminal<Request<TFunc, TArgs, TReturned>, Response<TReturned>>;
  private readonly responseHandlers: Map<
    Request<TFunc, TArgs, TReturned>['id'],
    (returned: TReturned) => void | Promise<void>
  >;

  /**
   * Calls a function on the server.
   * @param args The arguments to pass to the function.
   * @returns A promise that resolves to the returned value of the function.
   */
  public async request<T extends Client<TServer, TArgs, TReturned, TFunc>>(
    this: T,
    ...args: Readonly<TArgs>
  ): Promise<TReturned> {
    const request: Request<TFunc, TArgs, TReturned> = {
      id: generateId() as Request<TFunc, TArgs, TReturned>['id'],
      args,
    };
    this.terminal.post(request);
    return new Promise<TReturned>((resolve, reject) => {
      this.responseHandlers.set(request.id, resolve);
    });
  }

  /**
   * Creates a new {@linkcode Client} instance.
   * @param params Configures the created client instance.
   */
  public constructor(params: {
    /** Specifies a {@linkcode Terminal} that will be used to communicate with the {@linkcode Server} on the other side. */
    readonly terminal: Terminal<Request<TFunc, TArgs, TReturned>, Response<TReturned>>;
  }) {
    this.terminal = params.terminal;
    this.responseHandlers = new Map();

    this.terminal.addListener((response) => {
      const responseHandler = this.responseHandlers.get(response.id);
      if (responseHandler !== undefined) {
        responseHandler(response.returned);
        this.responseHandlers.delete(response.id);
      }
    });
  }
}

/**
 * A server that can be used to handle function calls from a {@linkcode Client}.
 *
 * ## Example (Web Worker as a Server)
 *
 * ### Web Worker side
 *
 * ```ts
 * // define a function
 * export const add = (arg1: number, arg2: number) => arg1 + arg2;
 *
 * // setup a server
 * const server = new Server({
 *   terminal: new MessagePortTerminal({ port: globalThis, channel: 'my-channel' }),
 *   func: add,
 * });
 * ```
 *
 * ### Window side
 *
 * ```ts
 * import { Client, MessagePortTerminal } from '@mgn901/mgn901-utils-ts/asyncify-events';
 * import type { add } from './worker.js';
 *
 * // setup a client
 * const worker = new Worker('worker.js');
 * const client = new Client<typeof add>({
 *   terminal: new MessagePortTerminal({ port: worker, channel: 'my-channel' }),
 * });
 *
 * // call a function on the server
 * client.request(1, 2).then((result) => {
 *   console.log(result); // => 3
 * });
 * ```
 */
export class Server<
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
> {
  private readonly terminal: Terminal<Response<TReturned>, Request<TFunc, TArgs, TReturned>>;

  /**
   * Creates a new {@linkcode Server} instance.
   * @param params Configures the created server instance.
   */
  public constructor(params: {
    /** Specifies a {@linkcode Terminal} that will be used to communicate with the {@linkcode Client} on the other side. */
    readonly terminal: Terminal<Response<TReturned>, Request<TFunc, TArgs, TReturned>>;
    /** Specifies a function that will be called when a request is received. */
    readonly func: TFunc;
  }) {
    this.terminal = params.terminal;

    this.terminal.addListener(async (request) => {
      const returned = await params.func(...request.args);
      this.terminal.post({ id: request.id, returned: returned });
    });
  }
}

/**
 * A terminal that can be used to communicate between a {@linkcode Client} and a {@linkcode Server}.
 */
export interface Terminal<TRequest, TResponse> {
  /** @internal This is used by {@linkcode Client} instances to send messages. */
  post(this: Terminal<TRequest, TResponse>, request: TRequest): void;

  /** @internal This is used by {@linkcode Server} instances to receive messages. */
  addListener(
    this: Terminal<TRequest, TResponse>,
    handleResponse: (this: unknown, response: TResponse) => void,
  ): void;
}

/**
 * An implementation of {@linkcode Terminal} that uses the `EventTarget` interface to communicate.
 */
export class EventTargetTerminal<TRequest, TResponse> implements Terminal<TRequest, TResponse> {
  private readonly me: EventTarget;
  private readonly destination: EventTarget;

  public post(this: EventTargetTerminal<TRequest, TResponse>, request: TRequest): void {
    this.destination.dispatchEvent(new MessageEvent('message', { data: request }));
  }

  public addListener(
    this: EventTargetTerminal<TRequest, TResponse>,
    handleResponse: (this: unknown, response: TResponse) => void,
  ): void {
    const handleMessage = (event: Event | MessageEvent<TResponse>) => {
      if (event instanceof MessageEvent) {
        handleResponse(event.data as TResponse);
      }
    };

    this.me.addEventListener('message', handleMessage);
  }

  public constructor(params: { readonly me: EventTarget; readonly destination: EventTarget }) {
    this.me = params.me;
    this.destination = params.destination;
  }
}

/**
 * An implementation of {@linkcode Terminal} that uses the `BroadcastChannel`-like interface to communicate.
 */
export class MessagePortTerminal<TRequest, TResponse> implements Terminal<TRequest, TResponse> {
  private readonly port:
    | BroadcastChannel
    | DedicatedWorkerGlobalScope
    | MessagePort
    | ServiceWorker
    | Window
    | Worker;
  private readonly channel: string;

  public post(this: MessagePortTerminal<TRequest, TResponse>, request: TRequest): void {
    this.port.postMessage({ channel: this.channel, body: request });
  }

  public addListener(
    this: MessagePortTerminal<TRequest, TResponse>,
    handleResponse: (response: TResponse) => void,
  ): void {
    const handleMessage = (event: Event | MessageEvent<TResponse>) => {
      if (event instanceof MessageEvent && event.data.channel === this.channel) {
        handleResponse(event.data.body as TResponse);
      }
    };

    this.port.addEventListener('message', handleMessage);
  }

  public constructor(params: {
    readonly port:
      | BroadcastChannel
      | DedicatedWorkerGlobalScope
      | MessagePort
      | ServiceWorker
      | Window
      | Worker;
    readonly channel: string;
  }) {
    this.port = params.port;
    this.channel = params.channel;
  }
}
