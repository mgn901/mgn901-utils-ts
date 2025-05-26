export type PreApplied<
  TTargetInterface extends (this: unknown, params: P) => R,
  TPreAppliedParams extends Record<never, never>,
  P extends Record<never, never> = Parameters<TTargetInterface>[0],
  R = ReturnType<TTargetInterface>,
> = (params: P & Partial<TPreAppliedParams>) => R;

/**
 * Returns the function that 2nd parameter object is pre-applied to 1st parameter function.
 *
 * @param func A function to be pre-applied.
 * @param preAppliedParams A parameter object pre-applied to the function.
 * @returns The function that pre-applied the `preAppliedParams` to the `func`.
 */
export const preApply =
  <
    TTargetInterface extends (this: unknown, params: P) => R,
    TPreAppliedParams extends Record<never, never>,
    P extends Record<never, never> = Parameters<TTargetInterface>[0],
    R = ReturnType<TTargetInterface>,
  >(
    func: (this: unknown, params: P & TPreAppliedParams) => R,
    preAppliedArgs: TPreAppliedParams,
  ): PreApplied<TTargetInterface, TPreAppliedParams, P, R> =>
  (params) =>
    func({ ...preAppliedArgs, ...params });

/**
 * Returns the functions that 2nd parameter object is pre-applied to original functions.
 *
 * @param functions A dictionary of functions to be pre-applied.
 * @param preAppliedParams A parameter object pre-applied to the functions.
 * @returns The dictionary of functions that pre-applied the `preAppliedParams` to the each function in original `functions`.
 */
export const bulkPreApply = <
  // biome-ignore lint/suspicious/noExplicitAny: 本当は`params`の型を`Record<string | number | symbol, unknown>`にしたいが、`params`の制約を拡張できなくなってしまうので、`any`にする。
  TTargetInterface extends Record<string, (this: unknown, params: any) => unknown>,
  TPreAppliedParams extends Record<never, never>,
>(
  functions: {
    readonly [K in keyof TTargetInterface]: (
      params: Parameters<TTargetInterface[K]>[0] & TPreAppliedParams,
    ) => ReturnType<TTargetInterface[K]>;
  },
  preAppliedParams: TPreAppliedParams,
): {
  [K in keyof TTargetInterface]: (
    this: unknown,
    params: Parameters<TTargetInterface[K]>[0] & Partial<TPreAppliedParams>,
  ) => ReturnType<TTargetInterface[K]>;
} =>
  Object.fromEntries(
    Object.entries(functions).map(([key, func]) => [
      key,
      (params: Parameters<TTargetInterface[typeof key]>[0] & Partial<TPreAppliedParams>) =>
        func({ ...preAppliedParams, ...params }),
    ]),
  ) as {
    [K in keyof TTargetInterface]: (
      this: unknown,
      params: Parameters<TTargetInterface[K]>[0] & Partial<TPreAppliedParams>,
    ) => ReturnType<TTargetInterface[K]>;
  };
