import { describe, expect, test } from '@jest/globals';
import { range } from './range';

describe('range', () => {
  test('returns an array of numbers from start to end (exclusive) with a given step', () => {
    expect(range(0, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(range(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(range(5, 15)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(range(5, 15, 3)).toEqual([5, 8, 11, 14]);
    expect(range(-10, -5)).toEqual([-10, -9, -8, -7, -6]);
    expect(range(-10.5, -5.5)).toEqual([-10.5, -9.5, -8.5, -7.5, -6.5]);
    expect(range(0.1, 0.3)).toEqual([0.1]);
  });
});
