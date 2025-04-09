/**
 * 指定された時間だけ待って解決する`Promise`を返す。
 * - `abortSignal`を指定していて、`abortSignal`に紐付いている`AbortController`で`abort`を呼び出した場合、返した`Promise`を拒否する。
 */
export const sleep = (params: {
  readonly timeoutMs: number;
  readonly abortSignal?: AbortSignal | undefined;
  readonly timerResetIntervalMs?: number | undefined;
}): Promise<void> => {
  const { timeoutMs, abortSignal, timerResetIntervalMs } = params;
  const endDate = new Date(Date.now() + Math.max(timeoutMs, 0));

  return new Promise((resolve, reject) => {
    // biome-ignore lint/style/useConst: `timeoutId`の代入よりも先に`onAbort`などで参照するため
    let periodicResetInterval: number | NodeJS.Timeout;
    let endDateTimeout: number | NodeJS.Timeout;

    const onAbort = () => {
      clearTimeout(endDateTimeout);
      clearInterval(periodicResetInterval);
      reject(abortSignal?.reason);
    };
    abortSignal?.addEventListener('abort', onAbort);

    const onEndDate = () => {
      clearInterval(periodicResetInterval);
      abortSignal?.removeEventListener('abort', onAbort);
      resolve();
    };

    // 実行予定時刻に向けてタイマーをセットする。
    endDateTimeout = setTimeout(onEndDate, Math.max(endDate.getTime() - Date.now(), 0));

    // そのタイマーを`timerResetIntervalMs`ミリ秒ごとにリセットする。
    periodicResetInterval = setInterval(() => {
      if (endDateTimeout !== undefined) {
        clearTimeout(endDateTimeout);
      }

      endDateTimeout = setTimeout(onEndDate, Math.max(endDate.getTime() - Date.now(), 0));
    }, timerResetIntervalMs ?? 1000);
  });
};

/**
 * 指定された日時に指定された関数を呼び出し、その戻り値で解決する`Promise`を返す。
 * - `abortSignal`を指定していて、`abortSignal`に紐付いている`AbortController`で`abort`を呼び出した場合、返した`Promise`を拒否する。
 */
export const executeAt = async <TFunc extends () => TReturned, TReturned>(params: {
  readonly date: Date;
  readonly func: TFunc;
  readonly abortSignal?: AbortSignal | undefined;
  readonly timerResetIntervalMs?: number | undefined;
}): Promise<TReturned> => {
  const { date, func, abortSignal, timerResetIntervalMs } = params;
  const now = new Date();
  await sleep({ timeoutMs: date.getTime() - now.getTime(), abortSignal, timerResetIntervalMs });
  return func();
};
