export interface AccumulateNeighborOptions {
  readonly startsAt?: number | undefined;
  readonly endsAt?: number | undefined;
}

/**
 * Returns a function that can be used as callback for
 * `Array.prototype.reduce()` to accumulate values based on neighboring
 * elements.
 * @param func - A function that takes the accumulated value, previous element,
 * current element, next element, index, and the entire array as arguments and
 * returns the new accumulated value.
 * @returns A function that can be used as callback for
 * `Array.prototype.reduce()` to accumulate values based on neighboring
 * elements.
 */
export const accumulateNeighbor =
  <A, T>(
    func: (
      acc: A,
      prev: T,
      current: T,
      next: T,
      index: number,
      array: readonly T[],
    ) => A,
    options?: AccumulateNeighborOptions,
  ) =>
  (acc: A, current: T, i: number, array: readonly T[]): A => {
    const startsAt = options?.startsAt ?? 0;
    const endsAt = options?.endsAt ?? array.length - 1;
    const endsAtNormalized = endsAt < 0 ? array.length - endsAt : endsAt;
    if (i < startsAt || i > endsAtNormalized) return acc;

    const prevI = i - 1 === -1 ? array.length - 1 : i - 1;
    const nextI = i + 1 === array.length ? 0 : i + 1;
    return func(acc, array[prevI], current, array[nextI], i, array);
  };
