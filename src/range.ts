/**
 * Returns an array of numbers from `start` to `end` (exclusive) with a given `step`.
 */
export const range = (start: number, end: number, step = 1) =>
  [...Array(Math.ceil((end - start) / step)).keys()].map(
    (_, index) => start + index * step,
  );

const sCurrent = Symbol('current');
const sEnd = Symbol('end');
const sStep = Symbol('step');

export class RangeIterator implements IterableIterator<number> {
  private [sCurrent]: number;
  private [sEnd]: number;
  private [sStep]: number;

  constructor(start: number, end: number, step = 1) {
    this[sCurrent] = start;
    this[sEnd] = end;
    this[sStep] = step;
  }

  next(...[_value]: [] | [unknown]): IteratorResult<number, undefined> {
    if (this[sCurrent] >= this[sEnd]) {
      return { done: true, value: undefined };
    }
    const value = this[sCurrent];
    this[sCurrent] += this[sStep];
    return { done: false, value };
  }

  return(_value?: unknown): IteratorResult<number, undefined> {
    return { done: true, value: undefined };
  }

  throw(_e?: unknown): IteratorResult<number, undefined> {
    return { done: true, value: undefined };
  }

  [Symbol.iterator](): this {
    return this;
  }
}
