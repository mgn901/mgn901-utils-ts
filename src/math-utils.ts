import { accumulateNeighbor } from './accumulation-utils.js';

/**
 * Returns the index and value of the maximum value in an array of numbers.
 */
export const max = (
  ...values: readonly number[]
): [index: number, max: number] =>
  values.reduce<[index: number, max: number]>(
    (cmax, current, i) => (cmax[1] < current ? [i, current] : cmax),
    [0, values[0]],
  );

/**
 * Returns the index and value of the minimum value in an array of numbers.
 */
export const min = (
  ...values: readonly number[]
): [index: number, min: number] =>
  values.reduce<[index: number, min: number]>(
    (cmin, current, i) => (cmin[1] > current ? [i, current] : cmin),
    [0, values[0]],
  );

/**
 * Returns the indices and values of the local maxima in an array of numbers. A
 * local maximum is a value that is greater than its neighbors.
 */
export const localMax = (
  ...values: readonly number[]
): [index: number, max: number][] =>
  values.reduce<[index: number, max: number][]>(
    accumulateNeighbor((acc, prev, current, next, i, array) => {
      if (i > 0 && current > prev && i < array.length - 1 && current > next)
        acc.push([i, current]);
      return acc;
    }),
    [],
  );

/**
 * Returns the indices and values of the local minima in an array of numbers. A
 * local minimum is a value that is less than its neighbors.
 */
export const localMin = (
  ...values: readonly number[]
): [index: number, min: number][] =>
  values.reduce<[index: number, min: number][]>(
    accumulateNeighbor((acc, prev, current, next, i, array) => {
      if (i > 0 && current < prev && i < array.length - 1 && current < next)
        acc.push([i, current]);
      return acc;
    }),
    [],
  );
