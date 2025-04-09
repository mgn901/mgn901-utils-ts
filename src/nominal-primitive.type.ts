/**
 * Generate Nominal Type named `K` and based on `T`
 */
export type Primitive = string | number | bigint | boolean | undefined | symbol | null;

export type NominalPrimitive<TPrimitive extends Primitive, N extends symbol> = TPrimitive &
  Record<N, unknown>;
