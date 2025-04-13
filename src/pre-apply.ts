/** 2つの引数オブジェクトを組み合わせる。 */
const mergeParams = <OriginalParams, TPreAppliedParams = Partial<OriginalParams>>(params: {
  readonly params: Omit<OriginalParams, keyof TPreAppliedParams>;
  readonly preAppliedParams: TPreAppliedParams;
}): OriginalParams => {
  return { ...params.preAppliedParams, ...params.params } as OriginalParams;
};

type WithHint<THint, TToHinted> = TToHinted & Partial<THint>;

/** 左辺を必須、右辺を必須ではないとする型を組み合わせた型を得る。 */
type RequireLeft<Left, Right> = Omit<Left, keyof Right> & Partial<Right>;

/** Get the type of the function that `TPreAppliedParams` is pre-applied to `F` */
export type PreApplied<
  F extends (this: unknown, params: never) => unknown,
  TPreAppliedParams = Partial<Parameters<F>[0]>,
> = F extends (this: unknown, params: infer P) => infer R
  ? (params: RequireLeft<P, TPreAppliedParams>) => R
  : never;

/**
 * Returns the function that 2nd parameter object is pre-applied to 1st parameter function.
 *
 * @param func A function to be pre-applied.
 * @param preAppliedParams A parameter object pre-applied to the function.
 * @returns The function that pre-applied the `preAppliedParams` to the `func`.
 */
export const preApply =
  <P, R, TPreAppliedParams = Partial<P>>(
    func: (this: unknown, params: P) => R,
    preAppliedParams: WithHint<P, TPreAppliedParams>,
  ): PreApplied<(this: unknown, params: P) => R, TPreAppliedParams> =>
  (params) =>
    func(mergeParams<P, TPreAppliedParams>({ params, preAppliedParams }));

/**
 * Returns the functions that 2nd parameter object is pre-applied to original functions.
 *
 * @param functions A dictionary of functions to be pre-applied.
 * @param preAppliedParams A parameter object pre-applied to the functions.
 * @returns The dictionary of functions that pre-applied the `preAppliedParams` to the each function in original `functions`.
 */
export const bulkPreApply = <
  TPreApplied extends Record<string, (this: unknown, params: never) => unknown>,
  TPreAppliedParams,
>(
  functions: {
    readonly [K in keyof TPreApplied]: (
      params: Parameters<TPreApplied[K]>[0] & TPreAppliedParams,
    ) => ReturnType<TPreApplied[K]>;
  },
  preAppliedParams: TPreAppliedParams,
): {
  [K in keyof TPreApplied]: (
    this: unknown,
    params: Parameters<TPreApplied[K]>[0] & Partial<TPreAppliedParams>,
  ) => ReturnType<TPreApplied[K]>;
} =>
  Object.fromEntries(
    Object.entries(functions).map(([key, func]) => [
      key,
      (params: Parameters<TPreApplied[typeof key]>[0] & Partial<TPreAppliedParams>) =>
        func(mergeParams({ params, preAppliedParams: preAppliedParams })),
    ]),
  ) as {
    [K in keyof TPreApplied]: (
      this: unknown,
      params: Parameters<TPreApplied[K]>[0] & Partial<TPreAppliedParams>,
    ) => ReturnType<TPreApplied[K]>;
  };
