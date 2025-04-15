/**
 * Returns an array of numbers from `start` to `end` (exclusive) with a given `step`.
 */
export const range = (start: number, end: number, step = 1) =>
  [...Array(Math.ceil((end - start) / step)).keys()].map((_, index) => start + index * step);
