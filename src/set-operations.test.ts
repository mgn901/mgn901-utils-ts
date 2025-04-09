import { describe, expect, test } from '@jest/globals';
import { dedupe, except, intersect, union } from './set-operations';

describe('set operations（集合演算）', () => {
  const a = [1, 2, 3, 4, 5, 8, 9, 11, 12, 14];
  const b = [-1, 0, 2, 4, 6, 7, 8, 10, 12, 13, 15];

  test('dedupe（重複排除）', () => {
    expect(dedupe([-1, -1, 0, 1, 2, 2, 3, 3, 4, 5, 6, 6])).toEqual([-1, 0, 1, 2, 3, 4, 5, 6]);
  });

  test('union（和集合）', () => {
    expect(union(a, b)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(union(b, a)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  test('except（差集合）', () => {
    expect(except(a, b)).toEqual([1, 3, 5, 9, 11, 14]);
    expect(except(b, a)).toEqual([-1, 0, 6, 7, 10, 13, 15]);
  });

  test('intersect（共通集合）', () => {
    expect(intersect(a, b)).toEqual([2, 4, 8, 12]);
    expect(intersect(b, a)).toEqual([2, 4, 8, 12]);
  });
});
