export type PartiallyPartial<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

export type PickByValue<T, U> = Pick<T, { [K in keyof T]: T[K] extends U ? K : never }[keyof T]>;
export type OmitByValue<T, U> = Pick<T, { [K in keyof T]: T[K] extends U ? never : K }[keyof T]>;

export type ExcludeFromTuple<T extends readonly unknown[], U> = T extends readonly []
  ? readonly []
  : T extends readonly [infer V, ...infer W]
    ? V extends U
      ? ExcludeFromTuple<W, U>
      : readonly [V, ...ExcludeFromTuple<W, U>]
    : T;

type KnownKeyOf<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K;
} extends { [_ in keyof T]: infer X | never }
  ? X
  : never;

export type OmitIndexSignature<T> = KnownKeyOf<T> extends keyof T ? Pick<T, KnownKeyOf<T>> : never;

export type ArrowFunction<T> = T extends (...args: infer A) => infer R
  ? (this: unknown, ...args: A) => R
  : T;

/** `T`から、メソッドや値に関数をとるプロパティを取り除いた型を得る。 */
export type FieldsOf<T> = OmitByValue<T, ((...args: never[]) => unknown) | symbol>;

/** `U`から`T`にはないフィールドを取り除いた型を得る。 */
export type PickEssential<T, K> = Pick<T, Extract<keyof T, K>>;
