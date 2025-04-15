import { sleep } from './timer';

export const promiseSequential = async <T>(params: {
  readonly wrappedPromises: (() => Promise<T>)[];
  readonly abortSignal: AbortSignal | undefined;
  readonly interval: number;
}): Promise<T[]> => {
  const results: T[] = [];
  for (const current of params.wrappedPromises) {
    if (params.abortSignal?.aborted) {
      break;
    }
    const result = await current();
    results.push(result);
    await sleep({ timeoutMs: params.interval });
  }
  return results;
};
