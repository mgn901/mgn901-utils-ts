import { afterAll, afterEach, beforeAll, describe, expect, it, jest, test } from '@jest/globals';
import { clientFromPort, portFromEventTarget, startServerFromPort } from './asyncify-events.js';

describe('asyncify-events', () => {
  const delayedAdd = jest.fn(
    (arg1: number, arg2: number) =>
      new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(arg1 + arg2);
        }, 1000);
      }),
  );

  const clientTarget = new EventTarget();
  const serverTarget = new EventTarget();

  const clientPort = portFromEventTarget(clientTarget, serverTarget);
  const serverPort = portFromEventTarget(serverTarget, clientTarget);

  const stopServer = startServerFromPort(delayedAdd, serverPort);
  const request = clientFromPort<typeof delayedAdd>(clientPort);

  beforeAll(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'setInterval');
    jest.spyOn(serverTarget, 'removeEventListener');
  });

  test('client can send a request and receive a response', async () => {
    const resultPromise = request(1, 2);
    jest.advanceTimersByTime(1000);

    expect(resultPromise).resolves.toBe(3);
    // Ensure that one request makes one call to the server function
    expect(delayedAdd).toHaveBeenCalledTimes(1);
  });

  test('client and server can handle multiple requests', async () => {
    const resultPromises = [];
    for (let i = 0; i < 10; i += 1) {
      const resultPromise = request(i, i + 1);
      resultPromises.push(resultPromise);
    }
    jest.advanceTimersByTime(1000);
    const results = await Promise.all(resultPromises);

    results.forEach((result, index) => {
      expect(result).toBe(index + (index + 1));
    });
    // Ensure that one request makes one call to the server function
    expect(delayedAdd).toHaveBeenCalledTimes(10);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    stopServer();
  });
});
