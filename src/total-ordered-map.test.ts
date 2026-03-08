import { describe, expect, test } from '@jest/globals';
import { LinkedTotalOrderedMap } from './total-ordered-map.js';

const toArrayValues = <T>(m: LinkedTotalOrderedMap<T>) =>
  Array.from(m.values());
const toArrayEntries = <T>(m: LinkedTotalOrderedMap<T>) =>
  Array.from(m.entries());
const toArrayKeys = <T>(m: LinkedTotalOrderedMap<T>) => Array.from(m.keys());

describe('LinkedTotalOrderedMap', () => {
  test('insert() increments the list size', () => {
    const m = new LinkedTotalOrderedMap<number>();

    expect(m.size).toBe(0);

    m.insert(1);
    expect(m.size).toBe(1);

    m.insert(0, 2);
    expect(m.size).toBe(2);
  });

  test('insert() to head keeps invariance', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.insert(2);
    m.insert(0, 0);

    expect(toArrayValues(m)).toEqual([0, 1, 2]);
    expect(m.get(0)).toBe(0);
  });

  test('insert() to tail keeps invariance', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.insert(2);
    m.insert(2, 3); // insert at index == size should append

    expect(toArrayValues(m)).toEqual([1, 2, 3]);
    expect(m.get(m.size - 1)).toBe(3);
  });

  test('insert() with out-of-bounds index should be clamped', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.insert(10, 5); // > size should be clamped to append

    expect(toArrayValues(m)).toEqual([1, 5]);
    expect(m.size).toBe(2);
  });

  test('insert() with out-of-bounds index should be clamped', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.insert(1_000_000, 7);

    expect(m.get(m.size - 1)).toBe(7);
    expect(m.size).toBe(2);
  });

  test('set() overrides existing value', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.insert(2);
    m.set(0, 9);

    expect(m.get(0)).toBe(9);
    expect(m.size).toBe(2);
  });

  test('set() with index equals to list size should be equal to append operation', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.set(1, 8); // index == size -> append

    expect(toArrayValues(m)).toEqual([1, 8]);
  });

  test('set() with out-of-bounds index should be equal to append operation', () => {
    const m = new LinkedTotalOrderedMap<number>();
    m.insert(1);
    m.set(10, 6); // out-of-bounds -> append

    expect(toArrayValues(m)).toEqual([1, 6]);
  });

  test('delete() of existing key should return true and remove the entry', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    m.insert(2);
    m.insert(3);
    const res = m.delete(1);

    expect(res).toBe(true);
    expect(m.size).toBe(2);
    expect(toArrayValues(m)).toEqual([1, 3]);
  });

  test('delete() of non-existing key should return false and do nothing', () => {
    const m = new LinkedTotalOrderedMap<number>();

    m.insert(1);
    const res = m.delete(10);

    expect(res).toBe(false);
    expect(m.size).toBe(1);
    expect(toArrayValues(m)).toEqual([1]);
  });

  test('clear() should reset the list to an empty state', () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2, 3]);

    expect(m.size).toBe(3);

    m.clear();

    expect(m.size).toBe(0);
    expect(m.get(0)).toBeUndefined();
    expect(Array.from(m.entries())).toEqual([]);
  });

  test('forEach() should iterate over all entries in order', () => {
    const m = new LinkedTotalOrderedMap<number>([10, 20, 30]);
    const seen: number[] = [];
    const keys: number[] = [];

    const thisArg = {};
    m.forEach(function (this: unknown, v, k, map) {
      seen.push(v);
      keys.push(k);
      expect(map).toBe(m);
      expect(this).toBe(thisArg);
    }, thisArg);

    expect(seen).toEqual([10, 20, 30]);
    expect(keys).toEqual([0, 1, 2]);
  });

  test('keys() should return an iterator over all keys in order', () => {
    const m = new LinkedTotalOrderedMap<number>([5, 6, 7]);

    expect(toArrayKeys(m)).toEqual([0, 1, 2]);
  });

  test('entries() should return an iterator over all entries in order', () => {
    const m = new LinkedTotalOrderedMap<number>([5, 6, 7]);

    expect(toArrayEntries(m)).toEqual([
      [0, 5],
      [1, 6],
      [2, 7],
    ]);
  });

  test('values() should return an iterator over all values in order', () => {
    const m = new LinkedTotalOrderedMap<number>([5, 6, 7]);

    expect(toArrayValues(m)).toEqual([5, 6, 7]);
  });

  test('toStringTag should return [object LinkedTotalOrderedMap]', () => {
    const m = new LinkedTotalOrderedMap<number>();

    expect(Object.prototype.toString.call(m)).toBe(
      '[object LinkedTotalOrderedMap]',
    );
  });
});

describe('LinkedTotalOrderedMap parity with Array', () => {
  test('insert() should produce the same order as Array.push()', () => {
    const m = new LinkedTotalOrderedMap<number>();
    const a: number[] = [];

    m.insert(1);
    a.push(1);
    m.insert(2);
    a.push(2);

    expect(toArrayValues(m)).toEqual(a);
  });

  test('insert() with index should produce the same order as Array.splice()', () => {
    const m = new LinkedTotalOrderedMap<number>();
    const a: number[] = [];

    m.insert(0, 1);
    a.splice(0, 0, 1);
    m.insert(1, 3);
    a.splice(1, 0, 3);
    m.insert(1, 2);
    a.splice(1, 0, 2);

    expect(toArrayValues(m)).toEqual(a);
  });

  test("set() should produce the same order as Array's index assignment", () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2, 3]);
    const a = [1, 2, 3];

    m.set(1, 9);
    a[1] = 9;

    expect(toArrayValues(m)).toEqual(a);
  });

  test('set() with index equals to list size should produce the same order as Array.push()', () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2]);
    const a = [1, 2];

    m.set(2, 8);
    a.push(8);

    expect(toArrayValues(m)).toEqual(a);
  });

  test('has() should produce the same result as Array.includes()', () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2, 3]);
    const a = [1, 2, 3];

    expect(m.hasValue(2)).toBe(a.includes(2));
    expect(m.hasValue(99)).toBe(a.includes(99));
  });

  test('indexOf() should produce the same result as Array.indexOf()', () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2, 3, 2]);
    const a = [1, 2, 3, 2];

    expect(m.indexOf(2)).toBe(a.indexOf(2));
    expect(m.indexOf(99)).toBe(a.indexOf(99));
  });

  test('delete() should produce the same order as Array.splice()', () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2, 3]);
    const a = [1, 2, 3];

    const res = m.delete(1);
    a.splice(1, 1);

    expect(res).toBe(true);
    expect(toArrayValues(m)).toEqual(a);
  });

  test('clear() should produce the same state as resetting an Array', () => {
    const m = new LinkedTotalOrderedMap<number>([1, 2, 3]);
    const a = [1, 2, 3];

    m.clear();
    a.length = 0;

    expect(m.size).toBe(a.length);
    expect(toArrayValues(m)).toEqual(a);
  });

  test('forEach() should produce the same order and values as Array.forEach()', () => {
    const m = new LinkedTotalOrderedMap<number>([4, 5, 6]);
    const a = [4, 5, 6];

    const seenM: number[] = [];
    const seenA: number[] = [];
    const thisArg = {};
    m.forEach(function (this: unknown, v) {
      seenM.push(v);
      expect(this).toBe(thisArg);
    }, thisArg);
    a.forEach(function (this: unknown, v) {
      seenA.push(v);
      expect(this).toBe(thisArg);
    }, thisArg);

    expect(seenM).toEqual(seenA);
  });

  test('LinkedTotalOrderedMap parity with Array (stress tests)', () => {
    const m = new LinkedTotalOrderedMap<number>();
    const a: number[] = [];

    for (let i = 0; i < 200; i++) {
      const op = i % 6;
      const val = i;
      if (op === 0) {
        m.insert(val);
        a.push(val);
      } else if (op === 1) {
        const idx = Math.floor(a.length / 2);
        m.insert(idx, val);
        a.splice(idx, 0, val);
      } else if (op === 2) {
        if (a.length === 0) continue;
        const idx = Math.floor(a.length / 2);
        m.set(idx, val);
        a[idx] = val;
      } else if (op === 3) {
        if (a.length === 0) continue;
        const idx = Math.floor(a.length / 3);
        m.delete(idx);
        a.splice(idx, 1);
      } else if (op === 4) {
        // deleteValue: remove first occurrence if present
        const target = a.length > 0 ? a[Math.floor(a.length / 2)] : val;

        const deleted = m.deleteValue(target);

        const ai = a.indexOf(target);
        if (ai !== -1) a.splice(ai, 1);

        expect(deleted).toBe(ai !== -1);
      } else if (op === 5) {
        m.clear();
        a.length = 0;
      }

      expect(toArrayValues(m)).toEqual(a);
    }
  });
});
