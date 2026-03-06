import type { AbortableFunction } from './asyncify-events.js';

/**
 * 指定された時間だけ待って解決する`Promise`を返す。
 * - `abortSignal`を指定していて、`abortSignal`に紐付いている`AbortController`で`abort`を呼び出した場合、返した`Promise`を拒否する。
 * - `timerResetIntervalMs`が`0`や負の値の場合、`timeoutMs`と同じ値を指定したものとする。
 */
export const sleep = (params: {
  readonly timeoutMs: number;
  readonly abortSignal?: AbortSignal | undefined;
  readonly timerResetIntervalMs?: number | undefined;
}): Promise<void> => {
  const DEFAULT_TIMER_RESET_INTERVAL_MS = 1000;

  const { timeoutMs, abortSignal, timerResetIntervalMs } = params;
  const endDate = new Date(Date.now() + Math.max(timeoutMs, 0));
  const usedTimerResetIntervalMs = (() => {
    const nonUndefinedInterval =
      timerResetIntervalMs ?? DEFAULT_TIMER_RESET_INTERVAL_MS;
    const positiveInterval =
      nonUndefinedInterval <= 0 ? timeoutMs : nonUndefinedInterval;
    const subtractedInterval =
      timeoutMs % positiveInterval === 0
        ? positiveInterval - 1
        : positiveInterval;
    return Math.max(subtractedInterval, 0);
  })();

  return new Promise((resolve, reject) => {
    let periodicResetInterval: number | NodeJS.Timeout;
    let endDateTimeout: number | NodeJS.Timeout;

    const onAbort = () => {
      clearTimeout(endDateTimeout);
      clearInterval(periodicResetInterval);
      reject(new Error(abortSignal?.reason));
    };
    abortSignal?.addEventListener('abort', onAbort);

    const onEndDate = () => {
      clearInterval(periodicResetInterval);
      abortSignal?.removeEventListener('abort', onAbort);
      resolve();
    };

    // 実行予定時刻に向けてタイマーをセットする。
    endDateTimeout = setTimeout(
      onEndDate,
      Math.max(endDate.getTime() - Date.now(), 0),
    );

    // そのタイマーを`timerResetIntervalMs`ミリ秒ごとにリセットする。
    periodicResetInterval = setInterval(() => {
      if (endDateTimeout !== undefined) {
        clearTimeout(endDateTimeout);
      }

      endDateTimeout = setTimeout(
        onEndDate,
        Math.max(endDate.getTime() - Date.now(), 0),
      );
    }, usedTimerResetIntervalMs);
  });
};

export type SchedulableFunction<TArgs extends unknown[], TReturned> = (
  args: TArgs,
  date: Date,
  abortSignal?: AbortSignal,
) => Promise<TReturned>;

/**
 * Returns a function that calls the specified`func` on the specified date.
 *
 * @param func The function to be called at the specified date.
 * @param timerResetIntervalMs The interval in milliseconds at which the timer should be reset. If `0` or negative, it will be treated as the same value as `timeoutMs`.
 * @returns A function that takes arguments in one `Array`, a `Date`, and an optional `AbortSignal`, and returns a promise that resolves with the result of calling `func` at the specified date.
 */
export const schedulableFunctionFromFunction = <
  TFunc extends (this: unknown, ...args: TArgs) => TReturned,
  TArgs extends unknown[] = Parameters<TFunc>,
  TReturned = ReturnType<TFunc>,
>(
  func: TFunc,
  timerResetIntervalMs?: number,
): SchedulableFunction<TArgs, Awaited<TReturned>> => {
  const abortableFunction = (args: TArgs) => func(...args);
  return schedulableFunctionFromAbortableFunction(
    abortableFunction,
    timerResetIntervalMs,
  );
};

/**
 * Returns a function that calls the specified`func` on the specified date.
 *
 * @param func The abortable function to be called at the specified date.
 * @param timerResetIntervalMs The interval in milliseconds at which the timer should be reset. If `0` or negative, it will be treated as the same value as `timeoutMs`.
 * @returns A function that takes arguments in one `Array`, a `Date`, and an optional `AbortSignal`, and returns a promise that resolves with the result of calling `func` at the specified date.
 */
export const schedulableFunctionFromAbortableFunction =
  <
    TFunc extends AbortableFunction<TArgs, TReturned>,
    TArgs extends unknown[] = Parameters<TFunc>[0],
    TReturned = ReturnType<TFunc>,
  >(
    func: TFunc,
    timerResetIntervalMs?: number,
  ): SchedulableFunction<TArgs, Awaited<TReturned>> =>
  /**
   * Calls the specified function at the specified date.
   *
   * @param args The arguments to be passed to the function.
   * @param date The date at which the function should be called.
   * @param abortSignal An optional `AbortSignal` that can be used to abort the execution. If the function is `AbortableFunction`, it will also be passed to the function.
   * @returns A promise that resolves with the result of calling `func` at the specified date.
   */
  async (args, date, abortSignal): Promise<Awaited<TReturned>> => {
    await sleep({
      timeoutMs: date.getTime() - Date.now(),
      abortSignal,
      timerResetIntervalMs,
    });
    const returned = await func(args, abortSignal);
    return returned;
  };
