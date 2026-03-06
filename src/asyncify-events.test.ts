import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import {
  abortableClientFromPort,
  clientFromPort,
  portFromEventTarget,
  startAbortableServerFromPort,
  startServerFromPort,
} from './asyncify-events.js';

const addAsync = jest.fn(
  (arg1: number, arg2: number) =>
    new Promise<number>((resolve) => {
      setTimeout(() => {
        resolve(arg1 + arg2);
      }, 1000);
    }),
);

const abortableAddAsync = jest.fn(
  (args: [number, number], abortSignal?: AbortSignal) =>
    new Promise<number>((resolve, reject) => {
      const handleAbort = (event: Event) => {
        clearTimeout(timeout);
        reject(
          new Error(
            event?.currentTarget instanceof AbortSignal
              ? event.currentTarget.reason
              : 'Aborted',
          ),
        );
      };

      abortSignal?.addEventListener('abort', handleAbort, { once: true });

      const timeout = setTimeout(() => {
        resolve(args[0] + args[1]);
        abortSignal?.removeEventListener('abort', handleAbort);
      }, 1000);
    }),
);

const rejectAsync = jest.fn(
  () =>
    new Promise<number>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Error'));
      }, 1000);
    }),
);

const abortableRejectAsync = jest.fn(
  (_args: [], abortSignal?: AbortSignal) =>
    new Promise<number>((_resolve, reject) => {
      const handleAbort = (event: Event) => {
        clearTimeout(timeout);
        reject(
          new Error(
            event?.currentTarget instanceof AbortSignal
              ? event.currentTarget.reason
              : 'Aborted',
          ),
        );
      };

      abortSignal?.addEventListener('abort', handleAbort, { once: true });

      const timeout = setTimeout(() => {
        reject(new Error('Error'));
        abortSignal?.removeEventListener('abort', handleAbort);
      }, 1000);
    }),
);

const add = jest.fn((args: [number, number], _abortSignal?: AbortSignal) => {
  return args[0] + args[1];
});

describe('asyncify-events', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'setInterval');
  });

  describe('Client: request and response handling', () => {
    const st = new EventTarget();
    const ct = new EventTarget();
    const stopServer = startServerFromPort(
      addAsync,
      portFromEventTarget({ me: st, other: ct, channel: 'my-channel' }),
    );
    const request = clientFromPort<typeof addAsync>(
      portFromEventTarget({ me: ct, other: st, channel: 'my-channel' }),
    );

    test('client should send a request and receive a response when  called', async () => {
      const resultPromise = request(1, 2);
      await jest.advanceTimersByTimeAsync(1000);

      expect(resultPromise).resolves.toBe(3);
      // Ensure that one request makes one call to the server function
      expect(addAsync).toHaveBeenCalledTimes(1);
    });

    test('client and server should handle multiple requests', async () => {
      const resultPromises = [];
      for (let i = 0; i < 10; i += 1) {
        const resultPromise = request(i, i + 1);
        resultPromises.push(resultPromise);
      }
      await jest.advanceTimersByTimeAsync(1000);
      const results = await Promise.all(resultPromises);

      results.forEach((result, index) => {
        expect(result).toBe(index + (index + 1));
      });
      // Ensure that one request makes one call to the server function
      expect(addAsync).toHaveBeenCalledTimes(10);
    });

    afterAll(() => {
      stopServer();
    });
  });

  describe('AbortableClient: request and response handling', () => {
    const st = new EventTarget();
    const ct = new EventTarget();
    const stopServer = startAbortableServerFromPort(
      abortableAddAsync,
      portFromEventTarget({ me: st, other: ct, channel: 'my-channel' }),
    );
    const request = abortableClientFromPort<typeof abortableAddAsync>(
      portFromEventTarget({ me: ct, other: st, channel: 'my-channel' }),
    );

    test('client should send a request and receive a response when called', async () => {
      const resultPromise = request([1, 2]);
      await jest.advanceTimersByTimeAsync(1000);

      expect(resultPromise).resolves.toBe(3);
      // Ensure that one request makes one call to the server function
      expect(abortableAddAsync).toHaveBeenCalledTimes(1);
    });

    test('client should handle abortSignal from the user', () => {
      const abortController = new AbortController();
      const resultPromise = request([1, 2], abortController.signal);
      abortController.abort('Custom abort reason');

      expect(resultPromise).rejects.toThrow('Custom abort reason');
    });

    test('client should handle multiple abortSignal from the user', () => {
      const promises = [];
      for (let i = 0; i < 10; i += 1) {
        const abortController = new AbortController();
        const resultPromise = request([i, i + 1], abortController.signal);
        promises.push(resultPromise);
        if (i % 2 === 0) {
          abortController.abort('Custom abort reason');
        }
      }

      Promise.allSettled(promises).then((results) => {
        results.forEach((result, i) => {
          if (i % 2 === 0 && result.status === 'rejected') {
            expect(result.reason).toBeInstanceOf(Error);
            expect(result.reason).toHaveProperty(
              'message',
              'Custom abort reason',
            );
          } else if (i % 2 === 1 && result.status === 'fulfilled') {
            expect(result.value).toBe(i + (i + 1));
          } else {
            throw new Error('Unexpected result status');
          }
        });
      });
      // Ensure that one request makes one call to the server function
      expect(abortableAddAsync).toHaveBeenCalledTimes(10);
    });

    afterAll(() => {
      stopServer();
    });
  });

  describe('Client: request and error handling', () => {
    const st = new EventTarget();
    const ct = new EventTarget();
    const stopServer = startServerFromPort(
      rejectAsync,
      portFromEventTarget({ me: st, other: ct, channel: 'my-channel' }),
    );
    const request = clientFromPort<typeof rejectAsync>(
      portFromEventTarget({ me: ct, other: st, channel: 'my-channel' }),
    );

    test('client should receive an error when an error thrown on the server', async () => {
      expect(request()).rejects.toThrow('Error');
    });

    afterAll(() => {
      stopServer();
    });
  });

  describe('AbortableClient: request and error handling', () => {
    const st = new EventTarget();
    const ct = new EventTarget();
    const stopServer = startAbortableServerFromPort(
      abortableRejectAsync,
      portFromEventTarget({ me: st, other: ct, channel: 'my-channel' }),
    );
    const request = abortableClientFromPort<typeof abortableRejectAsync>(
      portFromEventTarget({ me: ct, other: st, channel: 'my-channel' }),
    );

    test('client should receive an error when an error thrown on the server', async () => {
      expect(request([])).rejects.toThrow('Error');
    });

    afterAll(() => {
      stopServer();
    });
  });

  describe('AbortableClient: lifecycle management', () => {
    const st = new EventTarget();
    const ct = new EventTarget();
    const clientPort = portFromEventTarget({
      me: ct,
      other: st,
      channel: 'my-channel',
    });
    const stopServer = startAbortableServerFromPort(
      add,
      portFromEventTarget({ me: st, other: ct, channel: 'my-channel' }),
    );
    const request = abortableClientFromPort<typeof add>(clientPort);

    test('response handler should be stopped if unnecessary', async () => {
      jest.spyOn(clientPort, 'listen');

      const result1 = await request([1, 2]);
      expect(result1).toBe(3);
      expect(clientPort.listen).toHaveBeenCalledTimes(1);

      // この時点で1回目のリクエストに対するレスポンスは処理済みなので、待機中のレスポンスが無くなり、レスポンスをlistenする必要はなくなる。
      // 2回目のリクエストを送信すると、再度レスポンスをlistenする必要が生じるので、clientPort.listenが再度呼び出される。
      const result2 = await request([1, 2]);
      expect(result2).toBe(3);
      expect(clientPort.listen).toHaveBeenCalledTimes(2);
    });

    test('abort event handler should be removed after the request is resolved', async () => {
      const abortController = new AbortController();
      jest.spyOn(abortController.signal, 'addEventListener');
      jest.spyOn(abortController.signal, 'removeEventListener');
      await request([1, 2], abortController.signal);
      expect(abortController.signal.addEventListener).toHaveBeenCalledTimes(1);
      expect(abortController.signal.removeEventListener).toHaveBeenCalledTimes(
        1,
      );
    });

    afterAll(() => {
      stopServer();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });
});
