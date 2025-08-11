/** @internal */
type DefaultHandlers<TTypeKey extends string> = {
  // biome-ignore lint/suspicious/noExplicitAny: 本当は`params`の型を`unknown & ...`にしたいが、`params`の制約を拡張できなくなってしまうので、`any & ...`にする。
  readonly [K in string]: (this: unknown, params: any & { [TK in TTypeKey]: K }) => any;
};

/** @internal */
type ParamsOfType<
  K extends keyof THandlers,
  THandlers extends DefaultHandlers<TTypeKey>,
  TTypeKey extends string,
> = Extract<
  { [L in keyof THandlers]: Parameters<THandlers[L]>[0] }[keyof THandlers],
  { [TK in TTypeKey]: K }
>;

/** @internal */
type ReturnsOfType<
  K extends keyof THandlers,
  THandlers extends DefaultHandlers<TTypeKey>,
  TTypeKey extends string,
> = { [L in keyof THandlers]: ReturnType<THandlers[L]> }[K];

export type Router<THandlers extends DefaultHandlers<TTypeKey>, TTypeKey extends string> = <
  K extends keyof THandlers,
>(
  params: ParamsOfType<K, THandlers, TTypeKey>,
) => ReturnsOfType<K, THandlers, TTypeKey>;

/**
 * Creates a router that dispatches to the appropriate handler based on the value of the specified `typeKey` property in the parameter.
 *
 * @param handlers A dictionary of handlers where each key corresponds to a type and each value is a function that handles that type.
 * @param typeKey The key in the parameter object that determines which handler to call.
 * @returns A router function that takes a parameter object and calls the appropriate handler based on the `typeKey` value of the object.
 */
export const defineRouter =
  <THandlers extends DefaultHandlers<TTypeKey>, TTypeKey extends string>(
    handlers: THandlers,
    typeKey: TTypeKey,
  ): Router<THandlers, TTypeKey> =>
  (params) =>
    handlers[params[typeKey]](params);
