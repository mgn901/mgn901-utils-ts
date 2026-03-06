import {
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import {
  schedulableFunctionFromAbortableFunction,
  schedulableFunctionFromFunction,
  sleep,
} from './timer.js';

beforeAll(() => {
  jest.useFakeTimers();
  jest.spyOn(global, 'setTimeout');
  jest.spyOn(global, 'setInterval');
});

describe('timer', () => {
  describe('sleep', () => {
    test('sleep should resolve after specified timeout', (done) => {
      const startDate = Date.now();

      const promises1 = [
        sleep({ timeoutMs: 5000, timerResetIntervalMs: 1000 }),
        sleep({ timeoutMs: 5000, timerResetIntervalMs: 5000 }),
        sleep({ timeoutMs: 5000, timerResetIntervalMs: 10000 }),
      ];
      Promise.allSettled(promises1).then((results) => {
        const endDate = Date.now();
        for (const result of results) {
          expect(result.status).toBe('fulfilled');
          expect(result.status).not.toBe('rejected');
          expect(endDate - startDate).toBe(5000);
        }
        done();
      });
      jest.advanceTimersByTime(5000);

      const promises2 = [
        sleep({ timeoutMs: 0, timerResetIntervalMs: 0 }),
        sleep({ timeoutMs: 0, timerResetIntervalMs: 1000 }),
      ];
      Promise.allSettled(promises2).then((results) => {
        const endDate = Date.now();
        for (const result of results) {
          expect(result.status).toBe('fulfilled');
          expect(result.status).not.toBe('rejected');
          expect(endDate - startDate).toBe(0);
        }
      });
    });

    test('sleep should reject when aborted', () => {
      const abortController = new AbortController();
      const promise = sleep({
        timeoutMs: 5000,
        abortSignal: abortController.signal,
      });
      abortController.abort('custom abort reason');

      expect(promise).rejects.toHaveProperty('message', 'custom abort reason');
    });
  });

  describe('schedulable function', () => {
    const add = jest.fn((a: number, b: number, shouldFail: boolean): number => {
      if (shouldFail) {
        throw a + b;
      }
      return a + b;
    });
    const schedulableAdd = schedulableFunctionFromFunction(add);

    test('schedulable function should resolve with result at specified date', (done) => {
      const startDate = Date.now();
      const scheduledDate = new Date(startDate + 5000);

      schedulableAdd([1, 2, false], scheduledDate)
        .then((result) => {
          const endDate = Date.now();
          expect(endDate - startDate).toBe(5000);
          expect(add).toHaveBeenCalledTimes(1);
          expect(result).toBe(3);
          done();
        })
        .catch((error: unknown) => {
          throw new Error(`Promise should have been reoslved: ${error}`);
        });

      jest.advanceTimersByTime(5000);
    });

    test('schedulable function should reject when aborted', () => {
      const startDate = Date.now();
      const scheduledDate = new Date(startDate + 5000);
      const abortController = new AbortController();
      const promise = schedulableAdd(
        [1, 2, true],
        scheduledDate,
        abortController.signal,
      );
      abortController.abort('custom abort reason');

      expect(promise).rejects.toHaveProperty('message', 'custom abort reason');
      expect(add).toHaveBeenCalledTimes(0);
    });
  });

  describe('schedulable abortable function', () => {
    const abortableAdd = jest.fn(
      (
        args: [a: number, b: number, shouldFail: boolean],
        abortSignal?: AbortSignal,
      ): Promise<number> => {
        return new Promise((resolve, reject) => {
          const handleAbort = () => {
            reject(new Error('aborted in abortableAdd'));
          };
          const onTimeout = () => {
            abortSignal?.removeEventListener('abort', handleAbort);
            if (args[2]) {
              reject(args[0] + args[1]);
              return;
            }
            resolve(args[0] + args[1]);
          };
          abortSignal?.addEventListener('abort', handleAbort);
          setTimeout(onTimeout, 1000);
        });
      },
    );
    const schedulableAbortableAdd =
      schedulableFunctionFromAbortableFunction(abortableAdd);

    test('schedulable abortable function should resolve with result at specified date', async () => {
      const startDate = Date.now();
      const scheduledDate = new Date(startDate + 5000);
      const promise1 = schedulableAbortableAdd([1, 2, false], scheduledDate);
      await jest.advanceTimersByTimeAsync(6000);

      expect(promise1).resolves.toBe(3);
    });

    test('schedulable abortable function should reject when aborted (1)', () => {
      const startDate = Date.now();
      const scheduledDate = new Date(startDate + 5000);
      const abortController = new AbortController();
      const promise = schedulableAbortableAdd(
        [1, 2, true],
        scheduledDate,
        abortController.signal,
      );
      abortController.abort('custom abort reason');

      expect(promise).rejects.toHaveProperty('message', 'custom abort reason');
      expect(abortableAdd).toHaveBeenCalledTimes(0);
    });

    test('schedulable abortable function should reject when aborted (2)', async () => {
      const startDate = Date.now();
      const scheduledDate = new Date(startDate + 5000);
      const abortController = new AbortController();
      const promise = schedulableAbortableAdd(
        [1, 2, true],
        scheduledDate,
        abortController.signal,
      );
      await jest.advanceTimersByTimeAsync(5500);
      abortController.abort('custom abort reason');

      expect(promise).rejects.toHaveProperty(
        'message',
        'aborted in abortableAdd',
      );
    });
  });
});

afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});
