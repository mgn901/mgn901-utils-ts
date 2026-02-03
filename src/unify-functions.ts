type DefaultFunctions = {
  // biome-ignore lint/suspicious/noExplicitAny: 本当は`params`の型を`unknown & ...`にしたいが、`params`の制約を拡張できなくなってしまうので、`any & ...`にする。
  [key: string]: (this: unknown, ...args: any[]) => any;
};

/**
 * Unifies multiple functions into a single function that takes a key and arguments.
 * The key determines which function to call with the provided arguments.
 *
 * @param funcs An object where each key corresponds to a function.
 * @returns A function that takes an object with a key and arguments, and calls the corresponding function.
 */
export const unifyFunctions =
  <TFuncs extends DefaultFunctions>(funcs: TFuncs): UnifiedFunction<TFuncs> =>
  (key, ...args) =>
    funcs[key](...args);

export type UnifiedFunction<TFuncs extends DefaultFunctions> = <K extends keyof TFuncs>(
  key: K,
  ...args: Parameters<TFuncs[K]>
) => ReturnType<TFuncs[K]>;

/**
 * Divides a unified function into multiple functions based on the provided keys.
 * Each function can be called with its specific arguments.
 *
 * @param unifiedFunction A function that takes an object with a key and arguments, and calls the corresponding function.
 * @param keys An array of keys corresponding to the functions in the unified function.
 * @returns An object where each key corresponds to a function that can be called with its specific arguments.
 */
export const divideFunction = <TFuncs extends DefaultFunctions>(
  unifiedFunction: <K extends keyof TFuncs>(
    key: K,
    ...args: Parameters<TFuncs[K]>
  ) => ReturnType<TFuncs[K]>,
  keys: readonly (keyof TFuncs)[],
): TFuncs =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      (...args: Parameters<TFuncs[typeof key]>) => unifiedFunction(key, ...args),
    ]),
  ) as TFuncs;
