/**
 * Generate Nominal Type named `K` and based on `T`
 */
type Nominal<T, K extends string> = T & {
  __brand: K;
};

export type { Nominal };
